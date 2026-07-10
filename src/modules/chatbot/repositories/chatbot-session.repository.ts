import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChatbotSession } from '../entities/chatbot-session.entity';
import { SessionStatus } from '../enums/session-status.enum';

@Injectable()
export class ChatbotSessionRepository {
  constructor(
    @InjectRepository(ChatbotSession)
    private readonly repo: Repository<ChatbotSession>,
  ) {}

  create(userId: string): Promise<ChatbotSession> {
    const session = this.repo.create({
      userId,
      status: SessionStatus.ACTIVE,
      startedAt: new Date(),
    });
    return this.repo.save(session);
  }

  findById(id: string): Promise<ChatbotSession | null> {
    return this.repo.findOne({ where: { id } });
  }

  async endSession(id: string): Promise<ChatbotSession> {
    const session = await this.getOrThrow(id);
    session.status = SessionStatus.ENDED;
    session.endedAt = new Date();
    return this.repo.save(session);
  }

  count(): Promise<number> {
    return this.repo.count();
  }

  countActive(): Promise<number> {
    return this.repo.count({ where: { status: SessionStatus.ACTIVE } });
  }

  private async getOrThrow(id: string): Promise<ChatbotSession> {
    const session = await this.repo.findOne({ where: { id } });
    if (!session) throw new NotFoundException('Chatbot session not found');
    return session;
  }
}
