import { Injectable } from '@nestjs/common';

@Injectable()
export class UserPresenceService {
  private readonly userSockets = new Map<string, Set<string>>();
  private readonly socketUser = new Map<string, string>();

  userConnected(userId: string, socketId: string): void {
    if (!this.userSockets.has(userId)) {
      this.userSockets.set(userId, new Set());
    }
    this.userSockets.get(userId)!.add(socketId);
    this.socketUser.set(socketId, userId);
  }

  /** Returns the userId that owned the socket, if any, and deregisters it. */
  userDisconnected(socketId: string): string | undefined {
    const userId = this.socketUser.get(socketId);
    if (!userId) return undefined;

    this.socketUser.delete(socketId);
    const sockets = this.userSockets.get(userId);
    sockets?.delete(socketId);
    if (sockets && sockets.size === 0) {
      this.userSockets.delete(userId);
    }
    return userId;
  }

  isOnline(userId: string): boolean {
    return (this.userSockets.get(userId)?.size ?? 0) > 0;
  }

  /** Whether this was the user's last connected socket (i.e. they're now fully offline). */
  isLastSocket(userId: string): boolean {
    return !this.userSockets.has(userId);
  }

  getSocketIds(userId: string): string[] {
    return Array.from(this.userSockets.get(userId) ?? []);
  }

  getUserId(socketId: string): string | undefined {
    return this.socketUser.get(socketId);
  }
}
