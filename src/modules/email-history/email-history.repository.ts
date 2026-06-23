import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmailHistory } from './entity/email-history.entity';

@Injectable()
export class EmailHistoryRepository {
  constructor(
    @InjectRepository(EmailHistory)
    private readonly repo: Repository<EmailHistory>,
  ) {}

  create(data: Partial<EmailHistory>): EmailHistory {
    return this.repo.create(data);
  }

  async save(entity: EmailHistory): Promise<EmailHistory> {
    return this.repo.save(entity);
  }

  async findById(id: number): Promise<EmailHistory | null> {
    return this.repo.findOne({ where: { id } });
  }

  async findByGuid(guid: string): Promise<EmailHistory | null> {
    return this.repo.findOne({ where: { guid } });
  }

  async findSentByUser(userId: string): Promise<EmailHistory[]> {
    return this.repo.find({
      where: { fromUserId: userId },
      order: { sentAt: 'DESC' },
      select: ['id', 'guid', 'subject', 'toEmail', 'toUserId', 'emailType', 'status', 'sentAt', 'readAt'],
    });
  }

  async findReceivedByUser(userId: string): Promise<EmailHistory[]> {
    return this.repo.find({
      where: { toUserId: userId },
      order: { sentAt: 'DESC' },
      select: ['id', 'guid', 'subject', 'fromEmail', 'fromUserId', 'emailType', 'status', 'sentAt', 'readAt'],
    });
  }

  async findNotifications(userId: string): Promise<EmailHistory[]> {
    return this.repo.find({
      where: { toUserId: userId },
      order: { sentAt: 'DESC' },
      select: ['id', 'guid', 'subject', 'emailType', 'sentAt', 'readAt', 'openedAt'],
    });
  }

  async findConversation(user1Id: string, user2Id: string): Promise<EmailHistory[]> {
    return this.repo
      .createQueryBuilder('eh')
      .where(
        '(eh.from_user_id = :u1 AND eh.to_user_id = :u2) OR (eh.from_user_id = :u2 AND eh.to_user_id = :u1)',
        { u1: user1Id, u2: user2Id },
      )
      .orderBy('eh.sentAt', 'ASC')
      .select([
        'eh.id', 'eh.guid', 'eh.subject', 'eh.emailType',
        'eh.fromUserId', 'eh.toUserId', 'eh.sentAt', 'eh.readAt',
      ])
      .getMany();
  }

  async markAsRead(id: number): Promise<void> {
    await this.repo.update(id, { readAt: new Date() });
  }

  async markAllAsRead(toUser: string): Promise<void> {
    await this.repo.update({ toUserId: toUser }, { readAt: new Date() });
  }

  async markAsOpened(id: number): Promise<void> {
    await this.repo.update(id, { openedAt: new Date() });
  }
}
