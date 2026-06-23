import { Injectable, NotFoundException } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { EmailHistoryRepository } from './email-history.repository';
import { EmailHistory, EmailStatus } from './entity/email-history.entity';

export interface SaveEmailHistoryInput {
  emailType: string;
  fromUserId?: string;
  toUserId?: string;
  from: string;
  to: string | string[];
  cc?: string | string[];
  subject: string;
  html: string;
  status: 'SENT' | 'FAILED';
  provider?: string;
  providerMessageId?: string;
  metadata?: Record<string, any>;
  createdBy?: string;
}

@Injectable()
export class EmailHistoryService {
  constructor(private readonly emailHistoryRepo: EmailHistoryRepository) {}

  async saveEmailHistory(input: SaveEmailHistoryInput): Promise<EmailHistory> {
    const toEmail = Array.isArray(input.to) ? input.to.join(',') : input.to;
    const ccEmail = Array.isArray(input.cc) ? input.cc.join(',') : (input.cc ?? null);

    const record = this.emailHistoryRepo.create({
      guid:              uuidv4(),
      emailType:         input.emailType,
      fromUserId:        input.fromUserId ?? null,
      toUserId:          input.toUserId ?? null,
      fromEmail:         input.from,
      toEmail,
      ccEmail,
      subject:           input.subject,
      htmlContent:       input.html,
      status:            input.status,
      provider:          input.provider ?? 'ionos',
      providerMessageId: input.providerMessageId ?? null,
      sentAt:            input.status === EmailStatus.SENT ? new Date() : null,
      metadata:          input.metadata ?? null,
      createdBy:         input.createdBy ?? null,
    });

    return this.emailHistoryRepo.save(record);
  }

  async findById(id: number): Promise<EmailHistory> {
    const record = await this.emailHistoryRepo.findById(id);
    if (!record) throw new NotFoundException(`Email history #${id} not found`);
    return record;
  }

  async findByGuid(guid: string): Promise<EmailHistory> {
    const record = await this.emailHistoryRepo.findByGuid(guid);
    if (!record) throw new NotFoundException(`Email history ${guid} not found`);
    return record;
  }

  async getEmailsSentByUser(userId: string): Promise<EmailHistory[]> {
    return this.emailHistoryRepo.findSentByUser(userId);
  }

  async getEmailsReceivedByUser(userId: string): Promise<EmailHistory[]> {
    return this.emailHistoryRepo.findReceivedByUser(userId);
  }

  async getNotifications(userId: string): Promise<EmailHistory[]> {
    return this.emailHistoryRepo.findNotifications(userId);
  }

  async getConversation(user1Id: string, user2Id: string): Promise<EmailHistory[]> {
    return this.emailHistoryRepo.findConversation(user1Id, user2Id);
  }

  async markAsRead(id: number): Promise<{ message: string }> {
    await this.findById(id); // ensures record exists
    await this.emailHistoryRepo.markAsRead(id);
    return { message: 'Marked as read' };
  }

  async markAllAsRead(toUser: string): Promise<{ message: string }> {
    await this.emailHistoryRepo.markAllAsRead(toUser);
    return { message: 'Marked as all read' };
  }  

  async markAsOpened(id: number): Promise<{ message: string }> {
    await this.findById(id);
    await this.emailHistoryRepo.markAsOpened(id);
    return { message: 'Marked as opened' };
  }
}
