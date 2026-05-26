import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Conversation, Message } from '../user/entity';

@Injectable()
export class ChatService {
  private readonly icebreakers = [
    "What's the one thing you can't live without?",
    'If you could travel anywhere tomorrow, where would you go?',
    "What's your idea of a perfect weekend?",
    "What's your favourite book or movie?",
    'Do you prefer mountains or beaches?',
    "What's the most adventurous thing you've done?",
    "What's your go-to comfort food?",
    'If you could have dinner with anyone, who would it be?',
  ];

  constructor(
    @InjectRepository(Conversation) private readonly convRepo: Repository<Conversation>,
    @InjectRepository(Message) private readonly msgRepo: Repository<Message>,
  ) {}

  async getConversations(userId: string) {
    const convos = await this.convRepo
      .createQueryBuilder('c')
      .where('c.participantOneId = :userId OR c.participantTwoId = :userId', { userId })
      .orderBy('c.createdAt', 'DESC')
      .getMany();

    // Attach last message to each conversation
    const result: Array<Conversation & { lastMessage: Message | null }> = [];
    for (const c of convos) {
      const lastMessage = await this.msgRepo.findOne({
        where: { conversationId: c.id },
        order: { timestamp: 'DESC' },
      });
      result.push({ ...c, lastMessage });
    }
    return result;
  }

  async getMessages(conversationId: string) {
    const convo = await this.convRepo.findOne({ where: { id: conversationId } });
    if (!convo) throw new NotFoundException('Conversation not found');

    return this.msgRepo.find({
      where: { conversationId },
      order: { timestamp: 'ASC' },
    });
  }

  async startConversation(userId: string, receiverId: string) {
    // Check if conversation already exists
    const existing = await this.convRepo
      .createQueryBuilder('c')
      .where('(c.participantOneId = :userId AND c.participantTwoId = :receiverId) OR (c.participantOneId = :receiverId AND c.participantTwoId = :userId)', { userId, receiverId })
      .getOne();

    if (existing) return existing;

    const convo = this.convRepo.create({
      participantOneId: userId,
      participantTwoId: receiverId,
      isUnlocked: true,
    });
    return this.convRepo.save(convo);
  }

  async sendMessage(conversationId: string, senderId: string, content: string, type = 'text') {
    const convo = await this.convRepo.findOne({ where: { id: conversationId } });
    if (!convo) throw new NotFoundException('Conversation not found');

    const receiverId = convo.participantOneId === senderId ? convo.participantTwoId : convo.participantOneId;

    const message = this.msgRepo.create({
      conversationId,
      senderId,
      receiverId,
      content,
      type,
    });

    convo.unreadCount += 1;
    await this.convRepo.save(convo);

    return this.msgRepo.save(message);
  }

  async markAsRead(conversationId: string, userId: string) {
    await this.msgRepo
      .createQueryBuilder()
      .update(Message)
      .set({ isRead: true })
      .where('conversationId = :conversationId AND receiverId = :userId AND isRead = false', { conversationId, userId })
      .execute();

    const convo = await this.convRepo.findOne({ where: { id: conversationId } });
    if (convo) {
      convo.unreadCount = 0;
      await this.convRepo.save(convo);
    }

    return { message: 'Messages marked as read' };
  }

  getIcebreakers() {
    return this.icebreakers;
  }
}
