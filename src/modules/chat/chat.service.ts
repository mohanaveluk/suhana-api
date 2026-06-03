import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Conversation, Message, Profile, User } from '../user/entity';

@Injectable()
export class ChatService {
  private readonly typingState = new Map<string, { userId: string; expiresAt: number }>();

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
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(Profile) private readonly profileRepo: Repository<Profile>,
  ) {}

  async getConversations(userId: string) {
    const convos = await this.convRepo
      .createQueryBuilder('c')
      .where('c.participantOneId = :userId OR c.participantTwoId = :userId', { userId })
      .orderBy('c.createdAt', 'DESC')
      .getMany();

    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

    const result = await Promise.all(
      convos.map(async (c) => {
        const partnerId = c.participantOneId === userId ? c.participantTwoId : c.participantOneId;

        const [lastMessage, partner] = await Promise.all([
          this.msgRepo.findOne({
            where: { conversationId: c.id },
            order: { timestamp: 'DESC' },
          }),
          this.userRepo.findOne({
            where: {  id: partnerId  },
            relations: ['profile', 'profile.photos'],
          }),
        ]);

        let partnerProfile = partner?.profile ? {...partner?.profile, userId: partnerId} : null;
        return {
          ...c,
          lastMessage,
          partnerProfile: partnerProfile,
          partnerId,
          participants: [c.participantOneId, c.participantTwoId],
          isOnline: partner?.last_active ? partner.last_active > fiveMinutesAgo : false,
        };
      }),
    );

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
    return this.startConversationByProfiles(userId, receiverId);
  }

  async startConversationByProfiles(profileIdA: string, profileIdB: string, seedMessage?: string) {
    const existing = await this.convRepo
      .createQueryBuilder('c')
      .where('(c.participantOneId = :profileIdA AND c.participantTwoId = :profileIdB) OR (c.participantOneId = :profileIdB AND c.participantTwoId = :profileIdA)', { profileIdA, profileIdB })
      .getOne();

    if (existing) return existing;

    const convo = await this.convRepo.save(
      this.convRepo.create({ participantOneId: profileIdA, participantTwoId: profileIdB, isUnlocked: true }),
    );

    if (seedMessage) {
      await this.msgRepo.save(
        this.msgRepo.create({ conversationId: convo.id, senderId: profileIdA, receiverId: profileIdB, content: seedMessage, type: 'text' }),
      );
      convo.unreadCount = 1;
      await this.convRepo.save(convo);
    }

    return convo;
  }

  async sendMessage(conversationId: string, senderId: string, content: string, type = 'text') {
    const convo = await this.convRepo.findOne({ where: { id: conversationId } });
    if (!convo) throw new NotFoundException('Conversation not found');

    const receiverId = convo.participantOneId === senderId ? convo.participantTwoId : convo.participantOneId;

    const message = this.msgRepo.create({
      conversationId,
      senderId: senderId,
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

  async sendAttachment(conversationId: string, senderId: string, fileUrl: string) {
    const convo = await this.convRepo.findOne({ where: { id: conversationId } });
    if (!convo) throw new NotFoundException('Conversation not found');

    const receiverId = convo.participantOneId === senderId ? convo.participantTwoId : convo.participantOneId;

    const message = this.msgRepo.create({
      conversationId,
      senderId: senderId,
      receiverId,
      content: fileUrl,
      type: 'attachment',
      attachmentUrl: fileUrl,
    });

    convo.unreadCount += 1;
    await this.convRepo.save(convo);

    const messageResponse = await this.msgRepo.save(message);
    return messageResponse;
  }

  async setTyping(conversationId: string, userId: string, isTyping: boolean) {
    const convo = await this.convRepo.findOne({ where: { id: conversationId } });
    if (!convo) throw new NotFoundException('Conversation not found');

    if (isTyping) {
      this.typingState.set(conversationId, { userId, expiresAt: Date.now() + 5000 });
    } else {
      this.typingState.delete(conversationId);
    }

    return { conversationId, userId, isTyping };
  }

  getTyping(conversationId: string, requestUserId: string) {
    const state = this.typingState.get(conversationId);

    if (!state || Date.now() > state.expiresAt) {
      this.typingState.delete(conversationId);
      return { conversationId, isTyping: false };
    }

    if (state.userId === requestUserId) {
      return { conversationId, isTyping: false };
    }

    return { conversationId, isTyping: true };
  }

  async deleteMessage(conversationId: string, messageId: string, userId: string) {
    const message = await this.msgRepo.findOne({ where: { id: messageId, conversationId } });
    if (!message) throw new NotFoundException('Message not found');
    if (message.senderId !== userId) throw new ForbiddenException('Cannot delete another user\'s message');
    await this.msgRepo.delete(messageId);
    return { message: 'Message deleted' };
  }

  getIcebreakers() {
    return this.icebreakers;
  }
}
