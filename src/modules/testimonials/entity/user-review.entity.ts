import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index,
} from 'typeorm';
import { ReviewType, ReviewStatus, ReviewSentiment } from '../enums/testimonial.enums';

@Entity('user_review')
@Index('IDX_review_status_featured', ['status', 'isFeatured'])
@Index('IDX_review_status_created', ['status', 'createdAt'])
export class UserReview {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_review_user_id')
  @Column({ type: 'varchar', length: 36, name: 'user_id' })
  userId: string;

  @Column({ type: 'varchar', length: 36, name: 'profile_id', nullable: true })
  profileId: string | null;

  @Column({ type: 'enum', enum: ReviewType, default: ReviewType.GENERAL, name: 'review_type' })
  reviewType: ReviewType;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text', name: 'review_text' })
  reviewText: string;

  @Column({ type: 'tinyint', unsigned: true, name: 'overall_rating' })
  overallRating: number;

  @Column({ type: 'tinyint', unsigned: true, name: 'ease_of_use_rating', nullable: true })
  easeOfUseRating: number | null;

  @Column({ type: 'tinyint', unsigned: true, name: 'match_quality_rating', nullable: true })
  matchQualityRating: number | null;

  @Column({ type: 'tinyint', unsigned: true, name: 'communication_rating', nullable: true })
  communicationRating: number | null;

  @Column({ type: 'tinyint', unsigned: true, name: 'customer_support_rating', nullable: true })
  customerSupportRating: number | null;

  @Column({ type: 'tinyint', unsigned: true, name: 'trust_safety_rating', nullable: true })
  trustSafetyRating: number | null;

  @Column({ type: 'enum', enum: ReviewSentiment, nullable: true })
  sentiment: ReviewSentiment | null;

  @Column({ type: 'boolean', default: false, name: 'is_verified_review' })
  isVerifiedReview: boolean;

  @Index('IDX_review_status')
  @Column({ type: 'enum', enum: ReviewStatus, default: ReviewStatus.PENDING })
  status: ReviewStatus;

  @Index('IDX_review_is_featured')
  @Column({ type: 'boolean', default: false, name: 'is_featured' })
  isFeatured: boolean;

  @Column({ type: 'int', name: 'featured_order', nullable: true })
  featuredOrder: number | null;

  @Column({ type: 'int', default: 0, name: 'like_count' })
  likeCount: number;

  @Column({ type: 'int', default: 0, name: 'reply_count' })
  replyCount: number;

  @Column({ type: 'int', default: 0, name: 'report_count' })
  reportCount: number;

  @Column({ type: 'int', default: 0, name: 'view_count' })
  viewCount: number;

  @Column({ type: 'text', name: 'admin_notes', nullable: true })
  adminNotes: string | null;

  @Column({ type: 'varchar', length: 36, name: 'approved_by', nullable: true })
  approvedBy: string | null;

  @Column({ type: 'datetime', name: 'approved_at', nullable: true })
  approvedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date | null;
}
