import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { ReportReason, ReportStatus } from '../enums/testimonial.enums';

@Entity('review_report')
export class ReviewReport {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_report_review_id')
  @Column({ type: 'varchar', length: 36, name: 'review_id' })
  reviewId: string;

  @Index('IDX_report_reporter')
  @Column({ type: 'varchar', length: 36, name: 'reported_by_user_id' })
  reportedByUserId: string;

  @Column({ type: 'enum', enum: ReportReason })
  reason: ReportReason;

  @Column({ type: 'varchar', length: 1000, nullable: true })
  comments: string | null;

  @Index('IDX_report_status')
  @Column({ type: 'enum', enum: ReportStatus, default: ReportStatus.OPEN })
  status: ReportStatus;

  @Column({ type: 'varchar', length: 36, name: 'reviewed_by', nullable: true })
  reviewedBy: string | null;

  @Column({ type: 'datetime', name: 'reviewed_at', nullable: true })
  reviewedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
