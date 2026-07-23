import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Server, Socket } from 'socket.io';
import { CallsService } from './calls.service';
import { UserPresenceService } from './presence/user-presence.service';
import { User } from '../user/entity/user.entity';

const RING_TIMEOUT_MS = 45_000;

interface InitiatePayload {
  conversationId: string;
  type: 'audio' | 'video';
}
interface CallIdPayload {
  callId: string;
}
interface SdpPayload extends CallIdPayload {
  sdp: unknown;
}
interface IceCandidatePayload extends CallIdPayload {
  candidate: unknown;
}

@WebSocketGateway({ namespace: '/calls', cors: { origin: true, credentials: true } })
export class CallsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly ringTimeouts = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(
    private readonly jwtService: JwtService,
    private readonly presence: UserPresenceService,
    private readonly callsService: CallsService,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    try {
      const token = (client.handshake.auth?.token as string) || (client.handshake.query?.token as string);
      if (!token) throw new Error('Missing auth token');

      const payload = await this.jwtService.verifyAsync(token, {
        secret: process.env.JWT_SECRET || 'your-secret-key',
      });
      client.data.userId = payload.sub;
      this.presence.userConnected(payload.sub, client.id);
    } catch {
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket): void {
    const userId = this.presence.userDisconnected(client.id);
    if (!userId || !this.presence.isLastSocket(userId)) return;
    // Never let a transient DB/network error here take down the whole process —
    // this runs unattended on every disconnect, so it must not throw uncaught.
    this.cleanupActiveCallForUser(userId).catch(err =>
      console.error(`[CallsGateway] cleanupActiveCallForUser failed for ${userId}:`, err),
    );
  }

  // Returns { callId } (or { error }) as the socket.io ack, so the caller learns the callId
  // immediately without a dedicated ack event — needed so they can cancel/end before the
  // receiver answers.
  @SubscribeMessage('call:initiate')
  async handleInitiate(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: InitiatePayload,
  ): Promise<{ callId?: string; error?: string }> {
    const userId = client.data.userId as string;
    try {
      const receiverId = await this.callsService.resolveReceiverId(payload.conversationId, userId);

      if (await this.callsService.isBlocked(userId, receiverId)) {
        return { error: 'You cannot call this user' };
      }

      const call = await this.callsService.createRinging(userId, payload.conversationId, payload.type, client.id);

      if (this.presence.isOnline(receiverId)) {
        const caller = await this.getCallerInfo(userId);
        this.emitToUser(receiverId, 'call:incoming', {
          callId: call.id,
          type: call.type,
          conversationId: call.conversationId,
          caller,
        });
        this.ringTimeouts.set(
          call.id,
          setTimeout(() => {
            this.expireRing(call.id).catch(err =>
              console.error(`[CallsGateway] expireRing failed for call ${call.id}:`, err),
            );
          }, RING_TIMEOUT_MS),
        );
      } else {
        await this.callsService.markMissed(call.id);
        client.emit('call:missed', { callId: call.id, reason: 'offline' });
      }

      return { callId: call.id };
    } catch (err: any) {
      return { error: err?.message ?? 'Could not start call' };
    }
  }

  @SubscribeMessage('call:accept')
  async handleAccept(@ConnectedSocket() client: Socket, @MessageBody() payload: CallIdPayload): Promise<void> {
    try {
      this.clearRingTimeout(payload.callId);
      const updated = await this.callsService.accept(payload.callId, client.data.userId as string);
      this.emitToUser(updated.initiatedBy, 'call:accept', { callId: updated.id });
    } catch (err: any) {
      client.emit('call:error', { message: err?.message ?? 'Could not accept call' });
    }
  }

  @SubscribeMessage('call:decline')
  async handleDecline(@ConnectedSocket() client: Socket, @MessageBody() payload: CallIdPayload): Promise<void> {
    try {
      this.clearRingTimeout(payload.callId);
      const updated = await this.callsService.decline(payload.callId, client.data.userId as string);
      this.emitToUser(updated.initiatedBy, 'call:decline', { callId: updated.id });
    } catch (err: any) {
      client.emit('call:error', { message: err?.message ?? 'Could not decline call' });
    }
  }

  @SubscribeMessage('call:end')
  async handleEnd(@ConnectedSocket() client: Socket, @MessageBody() payload: CallIdPayload): Promise<void> {
    const userId = client.data.userId as string;
    try {
      this.clearRingTimeout(payload.callId);
      const updated = await this.callsService.end(payload.callId, userId);
      const otherId = updated.initiatedBy === userId ? updated.receiverId : updated.initiatedBy;
      this.emitToUser(otherId, 'call:end', {
        callId: updated.id,
        status: updated.status,
        durationSeconds: updated.durationSeconds,
      });
    } catch (err: any) {
      client.emit('call:error', { message: err?.message ?? 'Could not end call' });
    }
  }

  @SubscribeMessage('call:offer')
  async handleOffer(@ConnectedSocket() client: Socket, @MessageBody() payload: SdpPayload): Promise<void> {
    await this.relay(client, 'call:offer', payload);
  }

  @SubscribeMessage('call:answer')
  async handleAnswer(@ConnectedSocket() client: Socket, @MessageBody() payload: SdpPayload): Promise<void> {
    await this.relay(client, 'call:answer', payload);
  }

  @SubscribeMessage('call:ice-candidate')
  async handleIceCandidate(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: IceCandidatePayload,
  ): Promise<void> {
    await this.relay(client, 'call:ice-candidate', payload);
  }

  /** Forwards offer/answer/ICE-candidate payloads to the other participant of the call, unchanged. */
  private async relay(
    client: Socket,
    event: 'call:offer' | 'call:answer' | 'call:ice-candidate',
    payload: CallIdPayload,
  ): Promise<void> {
    const userId = client.data.userId as string;
    try {
      const call = await this.callsService.getById(payload.callId);
      if (call.initiatedBy !== userId && call.receiverId !== userId) {
        client.emit('call:error', { message: 'Not a participant of this call' });
        return;
      }
      const otherId = call.initiatedBy === userId ? call.receiverId : call.initiatedBy;
      this.emitToUser(otherId, event, { ...payload, from: userId });
    } catch (err: any) {
      client.emit('call:error', { message: err?.message ?? 'Could not relay call data' });
    }
  }

  private async expireRing(callId: string): Promise<void> {
    this.ringTimeouts.delete(callId);
    const call = await this.callsService.getById(callId).catch(() => null);
    if (!call || call.status !== 'RINGING') return;

    await this.callsService.markMissed(callId);
    this.emitToUser(call.initiatedBy, 'call:missed', { callId });
    this.emitToUser(call.receiverId, 'call:missed', { callId });
  }

  private async cleanupActiveCallForUser(userId: string): Promise<void> {
    const call = await this.callsService.findActiveCallForUser(userId);
    if (!call) return;

    this.clearRingTimeout(call.id);
    const otherId = call.initiatedBy === userId ? call.receiverId : call.initiatedBy;

    if (call.status === 'RINGING') {
      await this.callsService.markMissed(call.id);
      this.emitToUser(otherId, 'call:missed', { callId: call.id });
    } else if (call.status === 'ACCEPTED') {
      const updated = await this.callsService.end(call.id, userId);
      this.emitToUser(otherId, 'call:end', {
        callId: updated.id,
        status: updated.status,
        durationSeconds: updated.durationSeconds,
      });
    }
  }

  private clearRingTimeout(callId: string): void {
    const timeout = this.ringTimeouts.get(callId);
    if (timeout) {
      clearTimeout(timeout);
      this.ringTimeouts.delete(callId);
    }
  }

  private emitToUser(userId: string, event: string, data: unknown): void {
    this.presence.getSocketIds(userId).forEach(socketId => this.server.to(socketId).emit(event, data));
  }

  private async getCallerInfo(userId: string): Promise<{ id: string; name: string; photoUrl: string | null }> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    const photos = user?.profile?.photos ?? [];
    const photo = photos.find(p => p.isPrimary) ?? photos[0];
    return {
      id: userId,
      name: user ? `${user.first_name} ${user.last_name ?? ''}`.trim() : 'Someone',
      photoUrl: photo?.url ?? null,
    };
  }
}
