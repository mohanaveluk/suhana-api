import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { FeedbackRepository } from './feedback.repository';
import { CreateFeedbackDto } from './dto/create-feedback.dto';
import { CreateProfileFeedbackDto } from './dto/create-profile-feedback.dto';
import { ReplyFeedbackDto } from './dto/reply-feedback.dto';
import { FeedbackFilterDto } from './dto/feedback-filter.dto';
import { ApproveFeedbackDto, RejectFeedbackDto } from './dto/approve-reject-feedback.dto';
import {
  FeedbackResponseDto, FeedbackStatsResponseDto, PaginatedFeedbackResponseDto,
} from './dto/feedback-response.dto';
import { Feedback } from './entity/feedback.entity';
import { FeedbackType } from './enums/feedback-type.enum';
import { FeedbackStatus } from './enums/feedback-status.enum';
import { GENERAL_CATEGORIES, PROFILE_CATEGORIES } from './enums/feedback-category.enum';
import { User } from '../user/entity';
import { EmailService } from 'src/shared/email/email.service';
import { feedbackAdminNotificationTemplate, feedbackReplyTemplate, feedbackThankYouTemplate, profileFeedbackNotificationTemplate } from 'src/shared/email/templates/verify-email-template';

//const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'support@suhana.com';

@Injectable()
export class FeedbackService {
  constructor(
    private readonly feedbackRepo: FeedbackRepository,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    private readonly emailService: EmailService,
  ) {}

  // ---------------------------------------------------------------------------
  // Submit General Feedback
  // ---------------------------------------------------------------------------

  async createGeneralFeedback(
    userId: string,
    dto: CreateFeedbackDto,
    meta?: { ipAddress?: string, domain?: string },
  ): Promise<FeedbackResponseDto> {
    if (!GENERAL_CATEGORIES.includes(dto.category as any)) {
      throw new BadRequestException(
        `Category ${dto.category} is not valid for general feedback. Use a PROFILE_* category for profile feedback.`,
      );
    }

    const submitter = await this.getUserOrThrow(userId);

    const feedback = await this.feedbackRepo.createFeedback({
      feedbackType: FeedbackType.GENERAL,
      category: dto.category,
      rating: dto.rating,
      subject: dto.subject,
      message: dto.message,
      submittedByUserId: userId,
      submittedByProfileId: submitter.profile?.id,
      isAnonymous: dto.isAnonymous ?? false,
      isPublic: false,
      attachmentUrl: dto.attachmentUrl,
      deviceType: dto.deviceType,
      browser: dto.browser,
      osVersion: dto.osVersion,
      ipAddress: meta?.ipAddress,
      status: FeedbackStatus.PENDING,
      createdBy: userId,
      updatedBy: userId,
    });
    
    const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'support@suhana.com';
    const CC_EMAIL = process.env.CC_EMAIL || 'support@suhana.com';

    this.sendEmailsSilently([
      this.emailService.sendEmail({
        to: ADMIN_EMAIL,
        subject: `[Suhana] New Feedback: ${dto.subject}`,
        html: feedbackAdminNotificationTemplate({
          submitterName: `${submitter.first_name} ${submitter.last_name ?? ''}`.trim(),
          submitterEmail: submitter.email,
          category: dto.category,
          rating: dto.rating,
          subject: dto.subject,
          message: dto.message,
          feedbackId: feedback.id,
          adminPanelUrl: '/admin/feedback',
          domain: new URL(meta?.domain).hostname.replace(/^www\./, '') ?? process.env.FRONTEND_URL,
          submittedAt: feedback.createdAt,
          isAnonymous: dto.isAnonymous ?? false,
        }),
        history: { emailType: 'FEEDBACK_ADMIN_NOTIFICATION', fromUserId: userId, createdBy: userId },
      }),
      this.emailService.sendEmail({
        to: submitter.email,
        cc: CC_EMAIL,
        subject: 'Thank You For Your Feedback — Suhana Matrimony',
        html: feedbackThankYouTemplate({
          userName: submitter.first_name,
          category: dto.category,
          subject: dto.subject,
          rating: dto.rating,
          feedbackId: feedback.id,
          domain: new URL(meta?.domain).hostname.replace(/^www\./, '') ?? process.env.FRONTEND_URL,
        }),
        history: { emailType: 'FEEDBACK_THANK_YOU', toUserId: userId, createdBy: userId },
      }),
    ]);

    return this.toResponseDto(feedback);
  }

  // ---------------------------------------------------------------------------
  // Submit Profile Feedback
  // ---------------------------------------------------------------------------

  async createProfileFeedback(
    userId: string,
    dto: CreateProfileFeedbackDto,
    meta?: { domain?: string }
  ): Promise<FeedbackResponseDto> {
    if (!PROFILE_CATEGORIES.includes(dto.category as any)) {
      throw new BadRequestException(
        `Category ${dto.category} is not valid for profile feedback. Use PROFILE_POSITIVE, PROFILE_NEGATIVE, or PROFILE_REPORT.`,
      );
    }

    if (dto.targetUserId === userId) {
      throw new BadRequestException('You cannot submit feedback about your own profile');
    }

    const [submitter, targetUser] = await Promise.all([
      this.getUserOrThrow(userId),
      this.getUserOrThrow(dto.targetUserId),
    ]);

    const feedback = await this.feedbackRepo.createFeedback({
      feedbackType: FeedbackType.PROFILE,
      category: dto.category,
      rating: dto.rating,
      subject: dto.subject,
      message: dto.message,
      submittedByUserId: userId,
      submittedByProfileId: submitter.profile?.id,
      targetUserId: dto.targetUserId,
      targetProfileId: dto.targetProfileId ?? targetUser.profile?.id,
      isAnonymous: dto.isAnonymous ?? false,
      isPublic: false,
      attachmentUrl: dto.attachmentUrl,
      status: FeedbackStatus.PENDING,
      createdBy: userId,
      updatedBy: userId,
    });

    const submitterName = `${submitter.first_name} ${submitter.last_name ?? ''}`.trim();

    this.sendEmailsSilently([
      this.emailService.sendEmail({
        to: submitter.email,
        subject: 'Thank You For Your Feedback — Suhana Matrimony',
        html: feedbackThankYouTemplate({
          userName: submitter.first_name,
          subject: dto.subject,
          category: dto.category,
          rating: dto.rating,
          feedbackId: feedback.id,
          domain: new URL(meta?.domain).hostname.replace(/^www\./, '') ?? process.env.FRONTEND_URL,
        }),
        history: { emailType: 'FEEDBACK_THANK_YOU', toUserId: userId, createdBy: userId },
      }),
      this.emailService.sendEmail({
        to: targetUser.email,
        subject: 'New Feedback Received On Your Profile — Suhana Matrimony',
        html: profileFeedbackNotificationTemplate({
          targetName: targetUser.first_name,
          reviewerName: submitterName,
          isAnonymous: dto.isAnonymous ?? false,
          category: dto.category,
          subject: dto.subject,
          rating: dto.rating,
          loginUrl: '/login',
          domain: new URL(meta?.domain).hostname.replace(/^www\./, '') ?? process.env.FRONTEND_URL,
        }),
        history: {
          emailType: 'FEEDBACK_PROFILE_NOTIFICATION',
          fromUserId: userId,
          toUserId: dto.targetUserId,
          createdBy: userId,
        },
      }),
    ]);

    return this.toResponseDto(feedback);
  }

  // ---------------------------------------------------------------------------
  // Queries
  // ---------------------------------------------------------------------------

  async getAllFeedback(filter: FeedbackFilterDto): Promise<PaginatedFeedbackResponseDto> {
    const page = filter.page ?? 1;
    const limit = filter.limit ?? 20;
    const [data, total] = await this.feedbackRepo.getAllFeedback(filter);

    return {
      data: data.map((f) => this.toResponseDto(f)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getFeedbackById(id: string): Promise<FeedbackResponseDto> {
    const feedback = await this.feedbackRepo.getFeedbackById(id);
    if (!feedback) throw new NotFoundException('Feedback not found');
    return this.toResponseDto(feedback);
  }

  async getFeedbackByGuid(guid: string): Promise<FeedbackResponseDto> {
    const feedback = await this.feedbackRepo.getFeedbackByGuid(guid);
    if (!feedback) throw new NotFoundException('Feedback not found');
    return this.toResponseDto(feedback);
  }

  async getMyFeedback(userId: string): Promise<FeedbackResponseDto[]> {
    const feedbacks = await this.feedbackRepo.getFeedbackByUser(userId);
    return feedbacks.map((f) => this.toResponseDto(f));
  }

  async getFeedbackAboutMe(userId: string): Promise<FeedbackResponseDto[]> {
    const feedbacks = await this.feedbackRepo.getFeedbackForUser(userId);
    return feedbacks.map((f) => this.toResponseDto(f, false));
  }

  async getPublicProfileFeedback(profileId: string): Promise<FeedbackResponseDto[]> {
    const feedbacks = await this.feedbackRepo.getPublicProfileFeedback(profileId);
    // Mask submitter name for anonymous entries in public context
    return feedbacks.map((f) => this.toResponseDto(f, true));
  }

  async getFeedbackByUser(userId: string): Promise<FeedbackResponseDto[]> {
    const feedbacks = await this.feedbackRepo.getFeedbackForUser(userId, true);
    return feedbacks.map((f) => this.toResponseDto(f, true));
  }

  async getStatistics(): Promise<FeedbackStatsResponseDto> {
    return this.feedbackRepo.getStatistics();
  }

  // ---------------------------------------------------------------------------
  // Admin Actions
  // ---------------------------------------------------------------------------

  async approveFeedback(id: string, adminId: string, dto: ApproveFeedbackDto): Promise<FeedbackResponseDto> {
    const feedback = await this.feedbackRepo.approveFeedback(id, adminId, dto);
    return this.toResponseDto(feedback);
  }

  async rejectFeedback(id: string, adminId: string, dto: RejectFeedbackDto): Promise<FeedbackResponseDto> {
    const feedback = await this.feedbackRepo.rejectFeedback(id, adminId, dto);
    return this.toResponseDto(feedback);
  }

  async resolveFeedback(id: string, adminId: string): Promise<FeedbackResponseDto> {
    const feedback = await this.feedbackRepo.resolveFeedback(id, adminId);
    return this.toResponseDto(feedback);
  }

  async deleteFeedback(id: string): Promise<{ message: string }> {
    await this.feedbackRepo.softDelete(id);
    return { message: 'Feedback deleted successfully' };
  }

  // ---------------------------------------------------------------------------
  // Reply
  // ---------------------------------------------------------------------------

  async addReply(
    feedbackId: string,
    userId: string,
    dto: ReplyFeedbackDto,
    isAdmin: boolean,
    meta?: { domain?: string }
  ): Promise<FeedbackResponseDto> {
    const existing = await this.feedbackRepo.getFeedbackById(feedbackId);
    if (!existing) throw new NotFoundException('Feedback not found');

    if (!isAdmin && existing.submittedByUserId !== userId) {
      throw new ForbiddenException('You can only reply to your own feedback');
    }

    const feedback = await this.feedbackRepo.addReply(feedbackId, userId, dto.message);

    // Notify the original submitter when someone else (admin) replies
    if (isAdmin && existing.submittedByUserId !== userId) {
      const submitter = await this.userRepo.findOne({ where: { id: existing.submittedByUserId } });
      const replier = await this.userRepo.findOne({ where: { id: userId } });

      if (submitter?.email) {
        this.sendEmailsSilently([
          this.emailService.sendEmail({
            to: submitter.email,
            subject: 'Response To Your Feedback — Suhana Matrimony',
            html: feedbackReplyTemplate({
              userName: submitter.first_name,
              repliedBy: replier ? `${replier.first_name} ${replier.last_name ?? ''}`.trim() : 'Suhana Support',
              originalSubject: existing.subject,
              originalMessage: existing.message,
              replyMessage: dto.message,
              feedbackId: feedback.id,
              loginUrl: '/login',
              domain: meta?.domain ?? process.env.FRONTEND_URL,
            }),
            history: {
              emailType: 'FEEDBACK_REPLY',
              fromUserId: userId,
              toUserId: existing.submittedByUserId,
              createdBy: userId,
            },
          }),
        ]);
      }
    }

    return this.toResponseDto(feedback);
  }

  async getReplies(feedbackId: string): Promise<{ replyMessage: string; repliedAt: Date; repliedByUserId: string }> {
    const feedback = await this.feedbackRepo.getFeedbackById(feedbackId);
    if (!feedback) throw new NotFoundException('Feedback not found');
    return {
      replyMessage: feedback.replyMessage,
      repliedAt: feedback.repliedAt,
      repliedByUserId: feedback.repliedByUserId,
    };
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private async getUserOrThrow(userId: string): Promise<User> {
    const user = await this.userRepo.findOne({
      where: { id: userId },
      relations: ['profile'],
    });
    if (!user) throw new NotFoundException(`User ${userId} not found`);
    return user;
  }

  private toResponseDto(feedback: Feedback, maskAnonymous = false): FeedbackResponseDto {
    const submitterUser = feedback.submittedByUser;
    const submittedByName =
      maskAnonymous && feedback.isAnonymous
        ? null
        : submitterUser
          ? `${submitterUser.first_name} ${submitterUser.last_name ?? ''}`.trim()
          : null;

    const targetUser = feedback.targetUser;

    return {
      id: feedback.id,
      guid: feedback.guid,
      feedbackType: feedback.feedbackType,
      category: feedback.category,
      rating: feedback.rating,
      subject: feedback.subject,
      message: feedback.message,
      submittedByUserId: feedback.submittedByUserId,
      submittedByName,
      targetUserId: feedback.targetUserId,
      targetUserName: targetUser ? `${targetUser.first_name} ${targetUser.last_name ?? ''}`.trim() : undefined,
      status: feedback.status,
      isAnonymous: feedback.isAnonymous,
      isPublic: feedback.isPublic,
      priority: feedback.priority,
      adminNotes: feedback.adminNotes,
      replyMessage: feedback.replyMessage,
      repliedAt: feedback.repliedAt,
      attachmentUrl: feedback.attachmentUrl,
      resolvedAt: feedback.resolvedAt,
      createdAt: feedback.createdAt,
      updatedAt: feedback.updatedAt,
    };
  }

  // Fire-and-forget email sending — failures are logged but never thrown
  private sendEmailsSilently(promises: Promise<boolean>[]): void {
    Promise.all(promises.map((p) => p.catch((e) => console.error('[FeedbackService] Email error:', e))));
  }
}
