import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { UserReview } from '../entity/user-review.entity';
import { ReviewReply } from '../entity/review-reply.entity';
import { ReviewRepository } from '../repositories/review.repository';
import { ReviewReplyRepository } from '../repositories/review-reply.repository';
import { CreateReplyDto } from '../dto/review.dto';
import { ReplyStatus, ReviewStatus } from '../enums/testimonial.enums';
import { AuditEmitter } from '../../audit/audit.emitter';
import { AuditEventType } from '../../audit/enums/audit-event-type.enum';
import { AuditEntityType } from '../../audit/enums/audit-entity-type.enum';

interface ReplyAuthor {
  userId?: string;
  adminId?: string;
}

@Injectable()
export class ReviewRepliesService {
  constructor(
    private readonly reviewRepo: ReviewRepository,
    private readonly replyRepo: ReviewReplyRepository,
    private readonly audit: AuditEmitter,
    private readonly dataSource: DataSource,
  ) {}

  // Create a top-level or nested reply. Persisting the reply and bumping the
  // review's reply_count happen in one transaction so the counter can never
  // drift from the actual rows.
  async createReply(
    reviewId: string,
    author: ReplyAuthor,
    dto: CreateReplyDto,
    parentReplyId?: string,
  ): Promise<ReviewReply> {
    const review = await this.reviewRepo.findById(reviewId);
    if (!review || review.status !== ReviewStatus.APPROVED) {
      throw new NotFoundException('Review not found');
    }

    if (parentReplyId) {
      const parent = await this.replyRepo.findById(parentReplyId);
      if (!parent || parent.reviewId !== reviewId) {
        throw new BadRequestException('Parent reply does not belong to this review.');
      }
    }

    const saved = await this.dataSource.transaction(async (manager) => {
      const reply = manager.getRepository(ReviewReply).create({
        reviewId,
        parentReplyId: parentReplyId ?? null,
        userId: author.userId ?? null,
        adminId: author.adminId ?? null,
        replyText: dto.replyText,
        status: ReplyStatus.APPROVED,
      });
      const persisted = await manager.getRepository(ReviewReply).save(reply);
      await manager.getRepository(UserReview).increment({ id: reviewId }, 'replyCount', 1);
      return persisted;
    });

    this.audit.emit({
      eventType: AuditEventType.REVIEW_REPLY_ADDED,
      entityType: AuditEntityType.REVIEW_REPLY,
      entityId: saved.id,
      userId: author.userId,
      description: parentReplyId ? 'Nested reply added' : 'Reply added',
      newValue: { reviewId, parentReplyId: parentReplyId ?? null },
    });

    return saved;
  }

  // Returns the full nested reply tree for a review.
  async getReplyTree(reviewId: string): Promise<any[]> {
    const replies = await this.replyRepo.findByReview(reviewId);
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
}
