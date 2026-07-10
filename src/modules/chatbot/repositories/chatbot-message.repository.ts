import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChatbotMessage } from '../entities/chatbot-message.entity';
import { MessageRole } from '../enums/message-role.enum';

@Injectable()
export class ChatbotMessageRepository {
  constructor(
    @InjectRepository(ChatbotMessage)
    private readonly repo: Repository<ChatbotMessage>,
  ) {}

  save(data: Partial<ChatbotMessage>): Promise<ChatbotMessage> {
    return this.repo.save(this.repo.create(data));
  }

  getBySession(sessionId: string): Promise<ChatbotMessage[]> {
    return this.repo.find({
      where: { sessionId },
      order: { createdAt: 'ASC' },
    });
  }

  getHistory(sessionId: string, limit = 10): Promise<ChatbotMessage[]> {
    return this.repo.find({
      where: { sessionId, role: MessageRole.USER },
      order: { createdAt: 'DESC' },
      take: limit,
    }).then(msgs => msgs.reverse());
  }

  countBySource(source: string): Promise<number> {
    return this.repo.count({ where: { source, role: MessageRole.USER } });
  }

  countAll(): Promise<number> {
    return this.repo.count({ where: { role: MessageRole.USER } });
  }

  async getTopQuestions(limit = 10): Promise<{ message: string; count: number }[]> {
    return this.repo
      .createQueryBuilder('m')
      .select('m.message', 'message')
      .addSelect('COUNT(*)', 'count')
      .where('m.role = :role', { role: MessageRole.USER })
      .groupBy('m.message')
      .orderBy('count', 'DESC')
      .limit(limit)
      .getRawMany();
  }

  async getUnansweredTopics(limit = 20): Promise<{ message: string; count: number }[]> {
    return this.repo
      .createQueryBuilder('m')
      .select('m.message', 'message')
      .addSelect('COUNT(*)', 'count')
      .where('m.role = :role', { role: MessageRole.USER })
      .andWhere('m.source = :source', { source: 'AI' })
      .groupBy('m.message')
      .orderBy('count', 'DESC')
      .limit(limit)
      .getRawMany();
  }

  async findSimilarMessages(message: string): Promise<ChatbotMessage[]> {
    const words = message
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 3)
      .slice(0, 8);

    if (!words.length) return [];

    const qb = this.repo
      .createQueryBuilder('m')
      .where('m.role = :role', { role: MessageRole.USER })
      .andWhere('m.source = :source', { source: 'AI' })
      .andWhere('m.response IS NOT NULL');

    const conditions = words
      .map((_, i) => `LOWER(m.message) LIKE :w${i}`)
      .join(' OR ');
    const params = words.reduce<Record<string, string>>(
      (acc, w, i) => ({ ...acc, [`w${i}`]: `%${w}%` }),
      {},
    );
    qb.andWhere(`(${conditions})`, params);

    return qb.orderBy('m.createdAt', 'DESC').take(10).getMany();
  }

  async findOne(message: string): Promise<ChatbotMessage | null> {
    return this.repo.findOne({
      where: { message, role: MessageRole.USER },
    });
  }

  async getAverageMetrics(): Promise<{ avgResponseTime: number; avgTokens: number }> {
    const result = await this.repo
      .createQueryBuilder('m')
      .select('AVG(m.responseTimeMs)', 'avgResponseTime')
      .addSelect('AVG(m.tokensUsed)', 'avgTokens')
      .where('m.role = :role', { role: MessageRole.USER })
      .getRawOne();

    return {
      avgResponseTime: result?.avgResponseTime ? Math.round(Number(result.avgResponseTime)) : 0,
      avgTokens: result?.avgTokens ? Math.round(Number(result.avgTokens)) : 0,
    };
  }
}
