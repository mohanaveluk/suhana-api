import {
  BadRequestException, ForbiddenException, HttpException, HttpStatus, Injectable, NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Interest, InterestSource } from './entity/interest.entity';
import { Match, User, UserBlock } from '../user/entity';
import { EmailService } from 'src/shared/email/email.service';
import { CustomLoggerService } from '../logger/custom-logger.service';
import { EmailType } from '../email-history/entity/email-history.entity';
import { interestAcceptedEmailTemplate, interestRequestEmailTemplate } from 'src/shared/email/templates/verify-email-template';
import { v4 as uuidv4 } from 'uuid';
import { ChatService } from '../chat/chat.service';
import { AuditEmitter } from '../audit/audit.emitter';
import { AuditEventType } from '../audit/enums/audit-event-type.enum';
import { AuditEntityType } from '../audit/enums/audit-entity-type.enum';
import { UserSettings } from '../settings/entity/user-settings.entity';

/** Anti-spam cap on interests a member can send in any 24-hour window. */
export const MAX_INTERESTS_PER_DAY = 50;

@Injectable()
export class InterestsService {
  constructor(
    @InjectRepository(Interest) private readonly interestRepo: Repository<Interest>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(Match) private readonly matchRepo: Repository<Match>,
    @InjectRepository(UserBlock) private readonly blockRepo: Repository<UserBlock>,
    @InjectRepository(UserSettings) private readonly settingsRepo: Repository<UserSettings>,
    private emailService: EmailService,
    private logger: CustomLoggerService,
    private chatService: ChatService,
    private readonly auditEmitter: AuditEmitter,
  ) {}

  async getReceived(userId: string) {
    let interests = await this.interestRepo.find({
      where: { toUserId: userId },
      relations: ['fromUser', 'fromUser.profile', 'fromUser.profile.photos'],
      order: { createdAt: 'DESC' },
    });

    return this.formatInterests(interests);
  }

  async getSent(userId: string) {
    let interests = await this.interestRepo.find({
      where: { fromUserId: userId },
      relations: ['toUser', 'toUser.profile', 'toUser.profile.photos'],
      order: { createdAt: 'DESC' },
      });

    return interests;
  }

  async getSent1(userId: string) {
    let interests = await this.interestRepo.find({
      where: { fromUserId: userId },
      relations: ['toUser', 'toUser.profile', 'toUser.profile.photos'],
      order: { createdAt: 'DESC' },
    });
    return this.formatInterests(interests);
  }

  /**
   * Express interest. Compatibility scores never gate this — only self-interest, inactive or blocked
   * members, an existing open/answered interest, and the anti-spam daily cap do.
   * A previously *withdrawn* interest is re-opened (same row; the audit log keeps the history).
   */
  async send(fromUserId: string, toUserId: string, message?: string, domain?: string, source?: InterestSource) {
    if (fromUserId === toUserId) {
      throw new BadRequestException('Cannot send interest to yourself');
    }

    const existing = await this.interestRepo.findOne({ where: { fromUserId, toUserId } });
    if (existing && existing.status !== 'withdrawn') {
      throw new BadRequestException('Interest already sent to this user');
    }

    const sender = await this.userRepo.findOne({
      where: { id: fromUserId, is_active: 1 },
      relations: ['profile', 'profile.photos'],
    });
    const recipient = await this.userRepo.findOne({ where: { id: toUserId, is_active: 1 } });
    if (!sender) throw new ForbiddenException('Your account is not active');
    if (!recipient) throw new NotFoundException('This member is not available');

    if (await this.isBlockedBetween(fromUserId, toUserId)) {
      throw new ForbiddenException('You cannot send interest to this member');
    }

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const sentToday = await this.interestRepo
      .createQueryBuilder('i')
      .where('i.fromUserId = :fromUserId', { fromUserId })
      .andWhere('i.createdAt >= :since', { since })
      .getCount();
    if (sentToday >= MAX_INTERESTS_PER_DAY) {
      throw new HttpException(
        `You can send up to ${MAX_INTERESTS_PER_DAY} interests in 24 hours. Please try again later.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const match = await this.matchRepo.findOne({
      where: [
        { userId: fromUserId, matchedUserId: toUserId },
        { userId: toUserId, matchedUserId: fromUserId },
      ],
    });
    if (match) {
      match.status = 'interested';
      match.currentStep = 2;
      await this.matchRepo.save(match);
    }
    else{
      const newMatch = this.matchRepo.create({
        userId: fromUserId,
        matchedUserId: toUserId,
        matchPercentage: 0,
        status: 'interested',
        currentStep: 2,
      });
      await this.matchRepo.save(newMatch);
    }

    const interestGuid = uuidv4();
    let interest: Interest;
    if (existing) {
      // Re-opening a withdrawn interest.
      Object.assign(interest = existing, {
        status: 'pending', message, guid: interestGuid, source: source ?? existing.source,
        isRead: false, readAt: null, respondedAt: null, withdrawnAt: null,
      });
    } else {
      interest = this.interestRepo.create({ fromUserId, toUserId, message, guid: interestGuid, source: source ?? null });
    }
    const interestResponse = await this.interestRepo.save(interest);

    this.audit(AuditEventType.INTEREST_SENT, fromUserId, interestResponse, { status: 'pending', source: interestResponse.source });

    // Interest email — skipped when the recipient opted out (Settings → "Interest notifications").
    if (await this.wantsInterestEmails(recipient.id)) {
    this.logger.debug('Sending email...');
    await this.emailService.sendEmail({
      to: recipient.email,
      cc: "gcpstudy0@gmail.com",
      subject: `${sender.first_name} is interested in your profile – Aurora Matrimony`,
      html: interestRequestEmailTemplate({
        recipientFirstName: recipient.first_name,
        senderFirstName: sender.first_name,
        senderProfileId: sender.profile?.profileCode,
        senderAge: sender.profile?.age,
        senderLocation: sender.profile?.city,
        senderProfession: sender.profile?.occupationTitle,
        senderPhotoUrl: sender.profile?.photos?.[0]?.url ?? "https://storage.googleapis.com/inv-images/profile/userview.png",
        acceptUrl: `${domain}/accept/${interestResponse.id}/${interestGuid}`,
        viewProfileUrl: `${domain}/view/${sender.profile?.profileCode}`,
        domain: domain
    }),
      history: {
        emailType: EmailType.INTEREST_SENT,
        fromUserId: sender.id,
        toUserId: recipient.id,
        createdBy: sender.id
      }
    });
    this.logger.debug('Email has been sent');
    }

    return interestResponse;
  }

  /** Accept from the app (recipient only). Same follow-up as the email link: chat + notify sender. */
  async accept(interestId: string, userId: string) {
    const interest = await this.interestRepo.findOne({
      where: { id: interestId },
      relations: ['fromUser', 'fromUser.profile'],
    });
    if (!interest) throw new NotFoundException('Interest not found');
    if (interest.toUserId !== userId) throw new ForbiddenException('Cannot accept an interest not addressed to you');
    if (interest.status !== 'pending') throw new BadRequestException(`Interest is already ${interest.status}`);
    if (await this.isBlockedBetween(interest.fromUserId, interest.toUserId)) {
      throw new ForbiddenException('You cannot accept an interest from this member');
    }
    return this.completeAcceptance(interest);
  }

  async findPendingInterest(interestId: string, guid: string) {
    return this.interestRepo.findOne({
      where: { id: interestId, guid },
      relations: ['fromUser', 'fromUser.profile'],
    });
  }

  async acceptViaLink(interestId: string, guid: string): Promise<{
    success: boolean;
    message: string;
    requesterName?: string;
    requesterUserId?: string;
  }> {
    const interest = await this.findPendingInterest(interestId, guid);

    if (!interest) {
      return { success: false, message: 'Invalid or expired link' };
    }

    if (interest.status === 'accepted') {
      return { success: false, message: 'Interest already accepted' };
    }

    if (interest.status !== 'pending' || await this.isBlockedBetween(interest.fromUserId, interest.toUserId)) {
      return { success: false, message: 'Invalid or expired link' };
    }

    await this.completeAcceptance(interest);
    const requester = interest.fromUser;
    return {
      success:         true,
      message:         'Interest accepted successfully',
      requesterName:   `${requester?.first_name ?? ''} ${requester?.last_name ?? ''}`.trim(),
      requesterUserId: requester?.id,
    };
  }

  /** Recipient declines a pending interest. The sender sees "Declined" on their dashboard (no email). */
  async decline(interestId: string, userId: string) {
    const interest = await this.interestRepo.findOne({ where: { id: interestId } });
    if (!interest) throw new NotFoundException('Interest not found');
    if (interest.toUserId !== userId) throw new ForbiddenException('Cannot decline an interest not addressed to you');
    if (interest.status !== 'pending') throw new BadRequestException(`Interest is already ${interest.status}`);
    const now = new Date();
    Object.assign(interest, { status: 'declined', respondedAt: now, isRead: true, readAt: interest.readAt ?? now });
    const saved = await this.interestRepo.save(interest);
    this.audit(AuditEventType.INTEREST_REJECTED, userId, saved, { status: 'declined' }, { status: 'pending' });
    return saved;
  }

  /** Sender retracts a pending interest. Kept as history with status "withdrawn". */
  async withdraw(interestId: string, userId: string) {
    const interest = await this.interestRepo.findOne({ where: { id: interestId } });
    if (!interest) throw new NotFoundException('Interest not found');
    if (interest.fromUserId !== userId) throw new ForbiddenException('You can only withdraw interests you sent');
    if (interest.status !== 'pending') throw new BadRequestException(`Interest is already ${interest.status}`);
    Object.assign(interest, { status: 'withdrawn', withdrawnAt: new Date() });
    const saved = await this.interestRepo.save(interest);

    // The pair is no longer "interested" in the match funnel.
    await this.matchRepo
      .createQueryBuilder()
      .update(Match)
      .set({ status: 'suggested', currentStep: 0 })
      .where('status = :status', { status: 'interested' })
      .andWhere('((userId = :a AND matchedUserId = :b) OR (userId = :b AND matchedUserId = :a))', { a: saved.fromUserId, b: saved.toUserId })
      .execute();

    this.audit(AuditEventType.INTEREST_WITHDRAWN, userId, saved, { status: 'withdrawn' }, { status: 'pending' });
    return saved;
  }

  /** Recipient opened the interest ("New" → "Viewed"). Idempotent. */
  async markRead(interestId: string, userId: string) {
    const interest = await this.interestRepo.findOne({ where: { id: interestId } });
    if (!interest) throw new NotFoundException('Interest not found');
    if (interest.toUserId !== userId) throw new ForbiddenException('You can only mark interests sent to you');
    if (interest.isRead) return interest;
    Object.assign(interest, { isRead: true, readAt: new Date() });
    const saved = await this.interestRepo.save(interest);
    this.audit(AuditEventType.INTEREST_VIEWED, userId, saved, { isRead: true }, { isRead: false });
    return saved;
  }

  /** True when either member has an active block on the other. */
  async isBlockedBetween(a: string, b: string): Promise<boolean> {
    const count = await this.blockRepo
      .createQueryBuilder('b')
      .where('b.isActive = 1')
      .andWhere('((b.blockedByUserId = :a AND b.blockedUserId = :b) OR (b.blockedByUserId = :b AND b.blockedUserId = :a))', { a, b })
      .getCount();
    return count > 0;
  }

  // ── internals ─────────────────────────────────────────────────────────────

  /** pending → accepted, sync the match funnel, open the conversation and email the requester. */
  private async completeAcceptance(interest: Interest) {
    const now = new Date();
    Object.assign(interest, {
      status: 'accepted', acceptedOn: now, respondedAt: now, isRead: true, readAt: interest.readAt ?? now,
    });
    const saved = await this.interestRepo.save(interest);
    this.audit(AuditEventType.INTEREST_ACCEPTED, saved.toUserId, saved, { status: 'accepted' }, { status: 'pending' });

    // Sync match status to 'connected'
    const match = await this.matchRepo.findOne({
      where: [
        { userId: saved.fromUserId, matchedUserId: saved.toUserId },
        { userId: saved.toUserId,   matchedUserId: saved.fromUserId },
      ],
    });
    if (match) {
      match.status = 'connected';
      match.currentStep = 3;
      await this.matchRepo.save(match);
    } else {
      await this.matchRepo.save(
        this.matchRepo.create({
          userId: saved.fromUserId,
          matchedUserId: saved.toUserId,
          matchPercentage: 0,
          status: 'connected',
          currentStep: 3,
        }),
      );
    }

    // Load acceptor (toUser) to personalise the notification email
    const acceptor = await this.userRepo.findOne({
      where: { id: saved.toUserId },
      relations: ['profile']
    });

    // Start conversation between acceptor and requester
    if (acceptor?.profile && interest.fromUser?.profile) {
      try {
        const seedMessage = `Hi ${interest.fromUser?.profile?.firstName ?? 'User'}, Thank you for showing interest in my profile! I'm delighted by your response and would love to share more information about myself and learn more about you too.`;
        await this.chatService.startConversationByProfiles(
          acceptor.id,
          interest.fromUser.id,
          seedMessage
        );
      } catch (chatErr) {
        this.logger.debug(`Failed to start conversation: ${(chatErr as any)?.message}`);
      }
    }

    // Notify the original requester (fromUser)
    const requester = interest.fromUser;
    if (requester?.email && await this.wantsInterestEmails(requester.id)) {
      try {
        await this.emailService.sendEmail({
          to:      requester.email,
          subject: 'Your Interest request has been accepted',
          html:    interestAcceptedEmailTemplate({
            requesterFirstName: requester.first_name,
            acceptorFirstName:  acceptor?.first_name ?? 'Your match',
            loginUrl:           `${process.env.FRONTEND_URL}/chat`,
            domain:             process.env.FRONTEND_URL,
          }),
          history: {
            emailType: EmailType.INTEREST_ACCEPTED,
            fromUserId: saved.toUserId,
            toUserId:   saved.fromUserId,
            createdBy:  saved.toUserId,
          },
        });
      } catch (emailErr) {
        this.logger.debug(`Failed to send acceptance email: ${(emailErr as any)?.message}`);
      }
    }

    return saved;
  }

  /** Respects the member's "email me about interests" setting (default on when no settings row exists). */
  private async wantsInterestEmails(userId: string): Promise<boolean> {
    const settings = await this.settingsRepo.findOne({ where: { userId }, select: ['id', 'emailInterests'] });
    return settings?.emailInterests !== false;
  }

  /** Fire-and-forget audit trail entry for an interest status change. */
  private audit(
    eventType: AuditEventType, userId: string, interest: Interest,
    newValue: Record<string, unknown>, oldValue?: Record<string, unknown>,
  ): void {
    this.auditEmitter.emit({
      eventType,
      entityType: AuditEntityType.INTEREST,
      entityId: interest.id,
      userId,
      oldValue: oldValue ?? null,
      newValue: { ...newValue, fromUserId: interest.fromUserId, toUserId: interest.toUserId },
    });
  }

  private formatInterests(interests: Interest[]) {
    return interests.map((i) => this.formatInterest(i));
  }

  private formatInterest(interest: Interest) {
    let profile = interest.fromUser?.profile || interest.toUser?.profile;
    const userId = interest.fromUser?.id || interest.toUser?.id;
    let user = {
      id: interest.fromUser?.id || interest.toUser?.id,
      userId : interest.fromUser?.id || interest.toUser?.id,
      profile: {...profile, userId: userId},

    }
    return {
      id: interest.id,
      message: interest.message,
      status: interest.status,
      createdAt: interest.createdAt,
      toUserId: interest.toUserId,
      fromUserId: interest.fromUserId,
      fromUser: user,
    };
  }

  private formatInterest1(interest: Interest) {
    const profile = interest.fromUser?.profile || interest.toUser?.profile;
    return {
      user: interest.fromUser || interest.toUser,
      id: interest.id,
      userId: interest.fromUser?.id || interest.toUser?.id,
      profile: profile ? {
        userId: profile.id,
        id: profile.id,
        firstName: profile.firstName,
        lastName: profile.lastName,
        age: profile.age,
        gender: profile.gender,
        religion: profile.religion,
        motherTongue: profile.motherTongue,
        height: profile.height,
        aboutMe: profile.aboutMe,
        location: { city: profile.city, state: profile.state, country: profile.country, willingToRelocate: profile.willingToRelocate },
        education: { level: profile.educationLevel, field: profile.educationField, institution: profile.institution },
        occupation: { title: profile.occupationTitle, company: profile.company, annualIncome: profile.annualIncome, workingStatus: profile.workingStatus },
        familyDetails: { familyType: profile.familyType, fatherOccupation: profile.fatherOccupation, motherOccupation: profile.motherOccupation, siblings: profile.siblings, familyValues: profile.familyValues },
        photos: (profile.photos || []).map((ph) => ({ id: ph.id, url: ph.url, isPrimary: ph.isPrimary, isVerified: ph.isVerified })),
        horoscope: profile.horoscope,
        city: profile.city,
        state: profile.state,
        country: profile.country,
        preferences: profile.preferences,
        profileCode: profile.profileCode,

      } : null,
    };
  }

}
