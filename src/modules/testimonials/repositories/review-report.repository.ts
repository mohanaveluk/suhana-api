import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ReviewReport } from '../entity/review-report.entity';
import { ReportStatus } from '../enums/testimonial.enums';

@Injectable()
export class ReviewReportRepository {
  constructor(
    @InjectRepository(ReviewReport)
    private readonly repo: Repository<ReviewReport>,
  ) {}

  create(data: Partial<ReviewReport>): ReviewReport {
    return this.repo.create(data);
  }

  save(report: ReviewReport): Promise<ReviewReport> {
    return this.repo.save(report);
  }

  findById(id: string): Promise<ReviewReport | null> {
    return this.repo.findOne({ where: { id } });
  }

  findByReporter(userId: string, skip: number, take: number): Promise<[ReviewReport[], number]> {
    return this.repo.findAndCount({
      where: { reportedByUserId: userId },
      order: { createdAt: 'DESC' },
      skip,
      take,
    });
  }

  findByStatus(status: ReportStatus | undefined, skip: number, take: number): Promise<[ReviewReport[], number]> {
    return this.repo.findAndCount({
      where: status ? { status } : {},
      order: { createdAt: 'DESC' },
      skip,
      take,
    });
  }

  existingOpenReport(reviewId: string, userId: string): Promise<ReviewReport | null> {
    return this.repo.findOne({ where: { reviewId, reportedByUserId: userId } });
  }

  countOpen(): Promise<number> {
    return this.repo.count({ where: { status: ReportStatus.OPEN } });
  }
}
