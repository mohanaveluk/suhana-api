import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { UserReview } from '../entity/user-review.entity';
import { ReviewReport } from '../entity/review-report.entity';
import { ReviewRepository } from '../repositories/review.repository';
import { ReviewReportRepository } from '../repositories/review-report.repository';
import { ReportReviewDto } from '../dto/review.dto';
import { ReportStatus } from '../enums/testimonial.enums';
import { PaginatedResult } from 'src/common/dto/pagination.dto';
import { AuditEmitter } from '../../audit/audit.emitter';
import { AuditEventType } from '../../audit/enums/audit-event-type.enum';
import { AuditEntityType } from '../../audit/enums/audit-entity-type.enum';

@Injectable()
export class ReviewReportsService {
  constructor(
    private readonly reviewRepo: ReviewRepository,
    private readonly reportRepo: ReviewReportRepository,
    private readonly audit: AuditEmitter,
    private readonly dataSource: DataSource,
  ) {}

  // BR6: users can report reviews. One open report per (review, user).
  async report(reviewId: string, userId: string, dto: ReportReviewDto): Promise<ReviewReport> {
    const review = await this.reviewRepo.findById(reviewId);
    if (!review) throw new NotFoundException('Review not found');

    if (await this.reportRepo.existingOpenReport(reviewId, userId)) {
      throw new ConflictException('You have already reported this review.');
    }

    const saved = await this.dataSource.transaction(async (manager) => {
      const report = manager.getRepository(ReviewReport).create({
        reviewId,
        reportedByUserId: userId,
        reason: dto.reason,
        comments: dto.comments ?? null,
        status: ReportStatus.OPEN,
      });
      const persisted = await manager.getRepository(ReviewReport).save(report);
      await manager.getRepository(UserReview).increment({ id: reviewId }, 'reportCount', 1);
      return persisted;
    });

    this.audit.emit({
      eventType: AuditEventType.REVIEW_REPORTED,
      entityType: AuditEntityType.REVIEW_REPORT,
      entityId: saved.id,
      userId,
      description: `Review reported (${dto.reason})`,
      newValue: { reviewId, reason: dto.reason },
    });

    return saved;
  }

  async getMyReports(userId: string, page: number, limit: number): Promise<PaginatedResult<ReviewReport>> {
    const [items, total] = await this.reportRepo.findByReporter(userId, (page - 1) * limit, limit);
    return new PaginatedResult(items, total, page, limit);
  }
}
