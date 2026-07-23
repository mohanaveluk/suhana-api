import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Call } from './entity/call.entity';
import { Conversation } from '../user/entity/conversation.entity';
import { UserBlock } from '../user/entity/user-block.entity';

@Injectable()
export class CallsService {
  constructor(
    @InjectRepository(Call) private readonly callRepo: Repository<Call>,
    @InjectRepository(Conversation) private readonly conversationRepo: Repository<Conversation>,
    @InjectRepository(UserBlock) private readonly blockRepo: Repository<UserBlock>,
  ) {}

  async initiate(userId: string, conversationId: string, type: 'audio' | 'video') {
    const receiverId = await this.resolveReceiverId(conversationId, userId);
    const call = this.callRepo.create({
      conversationId,
      initiatedBy: userId,
      receiverId,
      type,
      status: 'PENDING',
    });
    return this.callRepo.save(call);
  }

  /** Used by the gateway once it has confirmed the call is actually ringing on the receiver's socket(s). */
  async createRinging(userId: string, conversationId: string, type: 'audio' | 'video', callerSocketId?: string) {
    const receiverId = await this.resolveReceiverId(conversationId, userId);
    const call = this.callRepo.create({
      conversationId,
      initiatedBy: userId,
      receiverId,
      type,
      status: 'RINGING',
      callerSocketId,
    });
    return this.callRepo.save(call);
  }

  async resolveReceiverId(conversationId: string, callerId: string): Promise<string> {
    const conv = await this.conversationRepo.findOne({ where: { id: conversationId } });
    if (!conv) throw new NotFoundException('Conversation not found');
    if (conv.participantOneId !== callerId && conv.participantTwoId !== callerId) {
      throw new ForbiddenException('You are not a participant of this conversation');
    }
    return conv.participantOneId === callerId ? conv.participantTwoId : conv.participantOneId;
  }

  async isBlocked(userA: string, userB: string): Promise<boolean> {
    const block = await this.blockRepo.findOne({
      where: [
        { blockedByUserId: userA, blockedUserId: userB, isActive: 1 },
        { blockedByUserId: userB, blockedUserId: userA, isActive: 1 },
      ],
    });
    return !!block;
  }

  async getById(callId: string): Promise<Call> {
    const call = await this.callRepo.findOne({ where: { id: callId } });
    if (!call) throw new NotFoundException('Call not found');
    return call;
  }

  async accept(callId: string, userId: string) {
    const call = await this.getById(callId);
    if (call.receiverId !== userId) throw new ForbiddenException('Only the receiver can accept this call');
    call.status = 'ACCEPTED';
    call.answeredAt = new Date();
    return this.callRepo.save(call);
  }

  async decline(callId: string, userId: string) {
    const call = await this.getById(callId);
    if (call.receiverId !== userId) throw new ForbiddenException('Only the receiver can decline this call');
    call.status = 'DECLINED';
    call.endedAt = new Date();
    return this.callRepo.save(call);
  }

  async markMissed(callId: string) {
    const call = await this.getById(callId);
    if (call.status !== 'RINGING' && call.status !== 'PENDING') return call;
    call.status = 'MISSED';
    call.endedAt = new Date();
    return this.callRepo.save(call);
  }

  /** Either participant may end the call. Duration is only recorded if it was actually answered. */
  async end(callId: string, userId: string) {
    const call = await this.getById(callId);
    if (call.initiatedBy !== userId && call.receiverId !== userId) {
      throw new ForbiddenException('Only a call participant can end this call');
    }

    const now = new Date();
    call.endedAt = now;

    if (call.status === 'ACCEPTED') {
      call.status = 'COMPLETED';
      call.durationSeconds = call.answeredAt
        ? Math.round((now.getTime() - call.answeredAt.getTime()) / 1000)
        : 0;
    } else if (call.status === 'RINGING' || call.status === 'PENDING') {
      call.status = 'DECLINED';
    }

    return this.callRepo.save(call);
  }

  async getHistory(userId: string, conversationId?: string) {
    const qb = this.callRepo
      .createQueryBuilder('c')
      .where('(c.initiatedBy = :userId OR c.receiverId = :userId)', { userId })
      .orderBy('c.startedAt', 'DESC');

    if (conversationId) {
      qb.andWhere('c.conversationId = :conversationId', { conversationId });
    }

    return qb.getMany();
  }

  async getMissed(userId: string) {
    return this.callRepo.find({
      where: { receiverId: userId, status: 'MISSED' },
      order: { startedAt: 'DESC' },
    });
  }

  /** The user's most recent still-ringing or in-progress call, if any — used for disconnect cleanup. */
  async findActiveCallForUser(userId: string): Promise<Call | null> {
    return this.callRepo.findOne({
      where: [
        { initiatedBy: userId, status: 'RINGING' },
        { receiverId: userId, status: 'RINGING' },
        { initiatedBy: userId, status: 'ACCEPTED' },
        { receiverId: userId, status: 'ACCEPTED' },
      ],
      order: { startedAt: 'DESC' },
    });
  }
}
