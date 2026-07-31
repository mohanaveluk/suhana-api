import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ReviewRepository } from '../repositories/review.repository';
import { ReviewReportRepository } from '../repositories/review-report.repository';
import { ReviewReplyRepository } from '../repositories/review-reply.repository';
import { ReviewLikeRepository } from '../repositories/review-like.repository';
import { SuccessStoryRepository } from '../repositories/success-story.repository';
import { UserReview } from '../entity/user-review.entity';
import { ReviewReport } from '../entity/review-report.entity';
import { SuccessStory } from '../entity/success-story.entity';
import { AdminReviewListQueryDto, FeatureReviewDto, RejectReviewDto } from '../dto/review.dto';
import { VerifyMarriageDto } from '../dto/success-story.dto';
import {
  MarriageVerificationStatus,
  ReportStatus,
  ReviewStatus,
  SuccessStoryStatus,
} from '../enums/testimonial.enums';
import { PaginatedResult } from 'src/common/dto/pagination.dto';
import { AuditEmitter } from '../../audit/audit.emitter';
import { AuditEventType } from '../../audit/enums/audit-event-type.enum';
import { AuditEntityType } from '../../audit/enums/audit-entity-type.enum';

@Injectable()
export class AdminReviewsService {
  constructor(
    private readonly reviewRepo: ReviewRepository,
    private readonly reportRepo: ReviewReportRepository,
    private readonly replyRepo: ReviewReplyRepository,
    private readonly likeRepo: ReviewLikeRepository,
    private readonly storyRepo: SuccessStoryRepository,
    private readonly audit: AuditEmitter,
  ) {}

  async listPending(page: number, limit: number): Promise<PaginatedResult<UserReview>> {
    const [items, total] = await this.reviewRepo.findPending((page - 1) * limit, limit);
    return new PaginatedResult(items, total, page, limit);
  }

  async listApproved(page: number, limit: number): Promise<PaginatedResult<UserReview>> {
    const [items, total] = await this.reviewRepo.findApproved((page - 1) * limit, limit);
    return new PaginatedResult(items, total, page, limit);
  }

  // Flexible listing for the admin console: filter by status and/or featured.
  async listReviews(query: AdminReviewListQueryDto): Promise<PaginatedResult<UserReview>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const [items, total] = await this.reviewRepo.findByFilters(
      { status: query.status, featured: query.featured, reviewType: query.reviewType },
      (page - 1) * limit,
      limit,
    );
    return new PaginatedResult(items, total, page, limit);
  }

  // BR3/BR4: approving publishes the review; an admin cannot approve their own.
  async approve(adminId: string, id: string): Promise<UserReview> {
    const review = await this.getReview(id);
    if (review.userId === adminId) {
      throw new ForbiddenException('You cannot approve your own review.');
    }
    review.status = ReviewStatus.APPROVED;
    review.approvedBy = adminId;
    review.approvedAt = new Date();
    const saved = await this.reviewRepo.save(review);

    this.audit.emit({
      eventType: AuditEventType.REVIEW_APPROVED,
      entityType: AuditEntityType.REVIEW,
      entityId: id,
      userId: adminId,
      description: 'Review approved',
    });
    return saved;
  }

  async reject(adminId: string, id: string, dto: RejectReviewDto): Promise<UserReview> {
    const review = await this.getReview(id);
    if (review.userId === adminId) {
      throw new ForbiddenException('You cannot moderate your own review.');
    }
    review.status = ReviewStatus.REJECTED;
    review.approvedBy = adminId;
    review.approvedAt = new Date();
    review.adminNotes = dto.adminNotes ?? review.adminNotes;
    const saved = await this.reviewRepo.save(review);

    this.audit.emit({
      eventType: AuditEventType.REVIEW_REJECTED,
      entityType: AuditEntityType.REVIEW,
      entityId: id,
      userId: adminId,
      description: 'Review rejected',
      newValue: { adminNotes: dto.adminNotes ?? null },
    });
    return saved;
  }

  // BR9/BR10: featured reviews appear on the homepage, ordered by featuredOrder.
  // Only an approved review can be featured.
  async setFeatured(adminId: string, id: string, dto: FeatureReviewDto): Promise<UserReview> {
    const review = await this.getReview(id);
    if (dto.featured && review.status !== ReviewStatus.APPROVED) {
      throw new BadRequestException('Only approved reviews can be featured.');
    }
    review.isFeatured = dto.featured;
    review.featuredOrder = dto.featured ? dto.featuredOrder ?? 0 : null;
    const saved = await this.reviewRepo.save(review);

    this.audit.emit({
      eventType: AuditEventType.REVIEW_FEATURED,
      entityType: AuditEntityType.REVIEW,
      entityId: id,
      userId: adminId,
      description: dto.featured ? 'Review featured' : 'Review unfeatured',
      newValue: { featured: dto.featured, featuredOrder: review.featuredOrder },
    });
    return saved;
  }

  // ── Reports ──────────────────────────────────────────────────────────────
  async listReports(status: ReportStatus | undefined, page: number, limit: number): Promise<PaginatedResult<ReviewReport>> {
    const [items, total] = await this.reportRepo.findByStatus(status, (page - 1) * limit, limit);
    return new PaginatedResult(items, total, page, limit);
  }

  async resolveReport(adminId: string, reportId: string, status: ReportStatus): Promise<ReviewReport> {
    const report = await this.reportRepo.findById(reportId);
    if (!report) throw new NotFoundException('Report not found');
    report.status = status;
    report.reviewedBy = adminId;
    report.reviewedAt = new Date();
    return this.reportRepo.save(report);
  }

  // ── Success stories ────────────────────────────────────────────────────────
  async approveStory(adminId: string, id: string): Promise<SuccessStory> {
    const story = await this.getStory(id);
    story.status = SuccessStoryStatus.APPROVED;
    story.approvedBy = adminId;
    const saved = await this.storyRepo.save(story);

    this.audit.emit({
      eventType: AuditEventType.SUCCESS_STORY_APPROVED,
      entityType: AuditEntityType.SUCCESS_STORY,
      entityId: id,
      userId: adminId,
      description: 'Success story approved',
    });
    return saved;
  }

  // Verified Marriage Badge decision.
  async verifyMarriage(adminId: string, id: string, dto: VerifyMarriageDto): Promise<any> {
    const story = await this.getStory(id);
    story.marriageVerificationStatus = dto.verified
      ? MarriageVerificationStatus.VERIFIED
      : MarriageVerificationStatus.REJECTED;
    story.verifiedMarriage = dto.verified;
    story.verifiedBy = adminId;
    story.verifiedAt = new Date();
    const saved = await this.storyRepo.save(story);

    if (dto.verified) {
      this.audit.emit({
        eventType: AuditEventType.SUCCESS_STORY_MARRIAGE_VERIFIED,
        entityType: AuditEntityType.SUCCESS_STORY,
        entityId: id,
        userId: adminId,
        description: 'Marriage verified — badge granted',
      });
    }

    return {
      id: saved.id,
      marriageVerificationStatus: saved.marriageVerificationStatus,
      verifiedMarriage: saved.verifiedMarriage,
      badge: saved.verifiedMarriage ? 'Verified Success Story' : null,
    };
  }

  // ── Dashboard ────────────────────────────────────────────────────────────
  async dashboard() {
    const [
      pendingReviews,
      approvedReviews,
      featuredReviews,
      averageRating,
      reportedReviews,
      totalReplies,
      totalLikes,
    ] = await Promise.all([
      this.reviewRepo.countByStatus(ReviewStatus.PENDING),
      this.reviewRepo.countByStatus(ReviewStatus.APPROVED),
      this.reviewRepo.countFeatured(),
      this.reviewRepo.approvedAverageRating(),
      this.reportRepo.countOpen(),
      this.replyRepo.countAll(),
      this.likeRepo.countAll(),
    ]);

    return {
      pendingReviews,
      approvedReviews,
      featuredReviews,
      averageRating,
      reportedReviews,
      totalReplies,
      totalLikes,
    };
  }

  private async getReview(id: string): Promise<UserReview> {
    const review = await this.reviewRepo.findById(id);
    if (!review) throw new NotFoundException('Review not found');
    return review;
  }

  private async getStory(id: string): Promise<SuccessStory> {
    const story = await this.storyRepo.findById(id);
    if (!story) throw new NotFoundException('Success story not found');
    return story;
  }
}
