import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../user/entity/user.entity';
import { ReviewRepository } from '../repositories/review.repository';
import { ReviewReplyRepository } from '../repositories/review-reply.repository';
import { ReviewLikeRepository } from '../repositories/review-like.repository';
import { SentimentAnalysisService } from './sentiment-analysis.service';
import { CreateReviewDto, PublicReviewQueryDto, UpdateReviewDto } from '../dto/review.dto';
import { UserReview } from '../entity/user-review.entity';
import { ReviewStatus, ReviewType } from '../enums/testimonial.enums';
import { PaginatedResult } from 'src/common/dto/pagination.dto';
import { AuditEmitter } from '../../audit/audit.emitter';
import { AuditEventType } from '../../audit/enums/audit-event-type.enum';
import { AuditEntityType } from '../../audit/enums/audit-entity-type.enum';

export interface ReviewAuthor {
  userId: string;
  name: string;
  profileImage: string | null;
}

@Injectable()
export class ReviewsService {
  constructor(
    private readonly reviewRepo: ReviewRepository,
    private readonly replyRepo: ReviewReplyRepository,
    private readonly likeRepo: ReviewLikeRepository,
    private readonly sentiment: SentimentAnalysisService,
    private readonly audit: AuditEmitter,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
  ) {}

  // ── Create (BR1: authenticated) ────────────────────────────────────────────
  async create(userId: string, dto: CreateReviewDto): Promise<UserReview> {
    const sentiment = await this.sentiment.analyzeReview(dto.title, dto.reviewText);

    const review = this.reviewRepo.create({
      userId,
      profileId: dto.profileId ?? null,
      reviewType: dto.reviewType ?? ReviewType.GENERAL,
      title: dto.title,
      reviewText: dto.reviewText,
      overallRating: dto.overallRating,
      easeOfUseRating: dto.easeOfUseRating ?? null,
      matchQualityRating: dto.matchQualityRating ?? null,
      communicationRating: dto.communicationRating ?? null,
      customerSupportRating: dto.customerSupportRating ?? null,
      trustSafetyRating: dto.trustSafetyRating ?? null,
      sentiment,
      status: ReviewStatus.PENDING, // BR7: admin approval required
    });

    const saved = await this.reviewRepo.save(review);

    this.audit.emit({
      eventType: AuditEventType.REVIEW_CREATED,
      entityType: AuditEntityType.REVIEW,
      entityId: saved.id,
      userId,
      profileId: dto.profileId ?? null,
      newValue: { title: saved.title, reviewType: saved.reviewType, overallRating: saved.overallRating },
      description: 'Review submitted',
    });

    return saved;
  }

  // ── Update (BR2: only while PENDING; owner only) ───────────────────────────
  async update(userId: string, id: string, dto: UpdateReviewDto): Promise<UserReview> {
    const review = await this.getOwnedReview(userId, id);
    if (review.status !== ReviewStatus.PENDING) {
      throw new ForbiddenException('Only pending reviews can be edited.');
    }

    const before = { title: review.title, reviewText: review.reviewText, overallRating: review.overallRating };

    Object.assign(review, {
      reviewType: dto.reviewType ?? review.reviewType,
      title: dto.title ?? review.title,
      reviewText: dto.reviewText ?? review.reviewText,
      overallRating: dto.overallRating ?? review.overallRating,
      easeOfUseRating: dto.easeOfUseRating ?? review.easeOfUseRating,
      matchQualityRating: dto.matchQualityRating ?? review.matchQualityRating,
      communicationRating: dto.communicationRating ?? review.communicationRating,
      customerSupportRating: dto.customerSupportRating ?? review.customerSupportRating,
      trustSafetyRating: dto.trustSafetyRating ?? review.trustSafetyRating,
    });

    // Re-run sentiment when the text changed.
    if (dto.title !== undefined || dto.reviewText !== undefined) {
      review.sentiment = await this.sentiment.analyzeReview(review.title, review.reviewText);
    }

    const saved = await this.reviewRepo.save(review);

    this.audit.emit({
      eventType: AuditEventType.REVIEW_UPDATED,
      entityType: AuditEntityType.REVIEW,
      entityId: saved.id,
      userId,
      oldValue: before,
      newValue: { title: saved.title, reviewText: saved.reviewText, overallRating: saved.overallRating },
      description: 'Review updated',
    });

    return saved;
  }

  // ── Soft delete (owner only) ────────────────────────────────────────────────
  async softDelete(userId: string, id: string): Promise<{ message: string }> {
    await this.getOwnedReview(userId, id);
    await this.reviewRepo.softDelete(id);
    return { message: 'Review deleted' };
  }

  async getMyReviews(userId: string, page: number, limit: number): Promise<PaginatedResult<UserReview>> {
    const [items, total] = await this.reviewRepo.findByUser(userId, (page - 1) * limit, limit);
    return new PaginatedResult(items, total, page, limit);
  }

  // ── Public listing ─────────────────────────────────────────────────────────
  async listPublic(query: PublicReviewQueryDto): Promise<PaginatedResult<any>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const [items, total] = await this.reviewRepo.findPublic(query, (page - 1) * limit, limit);
    const authors = await this.resolveAuthors(items.map((r) => r.userId));
    const withAuthors = items.map((r) => ({ ...r, author: authors.get(r.userId) ?? null }));
    return new PaginatedResult(withAuthors, total, page, limit);
  }

  async getPublicDetail(id: string, viewerId?: string): Promise<any> {
    const review = await this.reviewRepo.findById(id);
    if (!review || review.status !== ReviewStatus.APPROVED) {
      throw new NotFoundException('Review not found');
    }

    // Count a view (best-effort; does not block the response).
    void this.reviewRepo.incrementCounter(id, 'viewCount', 1);

    const [author, replies] = await Promise.all([
      this.resolveAuthor(review.userId),
      this.replyRepo.findByReview(id),
    ]);

    const likedByViewer = viewerId
      ? !!(await this.likeRepo.findOne(id, viewerId))
      : false;

    return {
      ...review,
      author,
      likedByViewer,
      replies: this.buildReplyTree(replies),
    };
  }

  async getFeatured(): Promise<any[]> {
    const items = await this.reviewRepo.findFeatured();
    const authors = await this.resolveAuthors(items.map((r) => r.userId));
    return items.map((r) => ({ ...r, author: authors.get(r.userId) ?? null }));
  }

  getStats() {
    return this.reviewRepo.getRatingStats();
  }

  // ── Shared helpers ──────────────────────────────────────────────────────────
  // Assembles a nested reply tree from a flat, chronologically-ordered list.
  private buildReplyTree(replies: any[]): any[] {
    const nodes = new Map<string, any>();
    const roots: any[] = [];
    for (const r of replies) nodes.set(r.id, { ...r, children: [] });
    for (const r of replies) {
      const node = nodes.get(r.id);
      if (r.parentReplyId && nodes.has(r.parentReplyId)) {
        nodes.get(r.parentReplyId).children.push(node);
      } else {
        roots.push(node);
      }
    }
    return roots;
  }

  private async getOwnedReview(userId: string, id: string): Promise<UserReview> {
    const review = await this.reviewRepo.findById(id);
    if (!review) throw new NotFoundException('Review not found');
    if (review.userId !== userId) throw new ForbiddenException('You do not own this review.');
    return review;
  }

  private async resolveAuthor(userId: string): Promise<ReviewAuthor | null> {
    return (await this.resolveAuthors([userId])).get(userId) ?? null;
  }

  private async resolveAuthors(userIds: string[]): Promise<Map<string, ReviewAuthor>> {
    const unique = [...new Set(userIds)].filter(Boolean);
    const map = new Map<string, ReviewAuthor>();
    if (!unique.length) return map;

    const users = await this.userRepo.find({ where: unique.map((id) => ({ id })) });
    for (const u of users) {
      map.set(u.id, {
        userId: u.id,
        name: [u.first_name, u.last_name].filter(Boolean).join(' ').trim() || 'Suhana Member',
        profileImage: u.profile_image ?? null,
      });
    }
    return map;
  }
}
