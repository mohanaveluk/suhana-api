import {
  Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn,
  BeforeInsert, Index, ManyToOne, JoinColumn,
} from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { FeedbackType } from '../enums/feedback-type.enum';
import { FeedbackCategory } from '../enums/feedback-category.enum';
import { FeedbackStatus } from '../enums/feedback-status.enum';
import { FeedbackPriority } from '../enums/feedback-priority.enum';
import { User } from '../../user/entity/user.entity';

@Entity('feedback')
@Index('IDX_FEEDBACK_SUBMITTED_BY', ['submittedByUserId'])
@Index('IDX_FEEDBACK_TARGET_USER', ['targetUserId'])
@Index('IDX_FEEDBACK_STATUS_TYPE', ['status', 'feedbackType'])
@Index('IDX_FEEDBACK_TARGET_PROFILE', ['targetProfileId', 'status', 'isPublic'])
export class Feedback {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id: string;

  @Column({ type: 'varchar', length: 36, nullable: true })
  guid: string;

  @BeforeInsert()
  generateIds() {
    if (!this.id) this.id = uuidv4();
    if (!this.guid) this.guid = uuidv4();
  }

  // ── Core ────────────────────────────────────────────────────────────────────

  @Column({ type: 'enum', enum: FeedbackType, name: 'feedback_type' })
  feedbackType: FeedbackType;

  @Column({ type: 'enum', enum: FeedbackCategory })
  category: FeedbackCategory;

  @Column({ type: 'tinyint', nullable: true, unsigned: true })
  rating: number;

  @Column({ type: 'varchar', length: 300 })
  subject: string;

  @Column({ type: 'text' })
  message: string;

  // ── Submitter ───────────────────────────────────────────────────────────────

  @Column({ type: 'varchar', length: 36, nullable: true, name: 'submitted_by_user_id' })
  submittedByUserId: string;

  @ManyToOne(() => User, { eager: false, nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'submitted_by_user_id' })
  submittedByUser: User;

  @Column({ type: 'varchar', length: 36, nullable: true, name: 'submitted_by_profile_id' })
  submittedByProfileId: string;

  // ── Target (profile feedback only) ─────────────────────────────────────────

  @Column({ type: 'varchar', length: 36, nullable: true, name: 'target_user_id' })
  targetUserId: string;

  @ManyToOne(() => User, { eager: false, nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'target_user_id' })
  targetUser: User;

  @Column({ type: 'varchar', length: 36, nullable: true, name: 'target_profile_id' })
  targetProfileId: string;

  // ── Status & Visibility ─────────────────────────────────────────────────────

  @Column({ type: 'enum', enum: FeedbackStatus, default: FeedbackStatus.PENDING })
  status: FeedbackStatus;

  @Column({ type: 'boolean', default: false, name: 'is_anonymous' })
  isAnonymous: boolean;

  @Column({ type: 'boolean', default: false, name: 'is_public' })
  isPublic: boolean;

  @Column({ type: 'enum', enum: FeedbackPriority, default: FeedbackPriority.LOW })
  priority: FeedbackPriority;

  // ── Admin fields ────────────────────────────────────────────────────────────

  @Column({ type: 'text', nullable: true, name: 'admin_notes' })
  adminNotes: string;

  @Column({ type: 'varchar', length: 36, nullable: true, name: 'resolved_by' })
  resolvedBy: string;

  @Column({ type: 'datetime', nullable: true, name: 'resolved_at' })
  resolvedAt: Date;

  // ── Reply ───────────────────────────────────────────────────────────────────

  @Column({ type: 'text', nullable: true, name: 'reply_message' })
  replyMessage: string;

  @Column({ type: 'varchar', length: 36, nullable: true, name: 'replied_by_user_id' })
  repliedByUserId: string;

  @Column({ type: 'datetime', nullable: true, name: 'replied_at' })
  repliedAt: Date;

  // ── Device / Context (for debugging) ────────────────────────────────────────

  @Column({ type: 'varchar', length: 50, nullable: true, name: 'device_type' })
  deviceType: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  browser: string;

  @Column({ type: 'varchar', length: 100, nullable: true, name: 'os_version' })
  osVersion: string;

  @Column({ type: 'varchar', length: 45, nullable: true, name: 'ip_address' })
  ipAddress: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  country: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  city: string;

  @Column({ type: 'varchar', length: 500, nullable: true, name: 'attachment_url' })
  attachmentUrl: string;

  // ── Soft Delete ─────────────────────────────────────────────────────────────

  @Column({ type: 'boolean', default: false, name: 'is_deleted' })
  isDeleted: boolean;

  @Column({ type: 'datetime', nullable: true, name: 'deleted_at' })
  deletedAt: Date;

  // ── Audit ───────────────────────────────────────────────────────────────────

  @Column({ type: 'varchar', length: 36, nullable: true, name: 'created_by' })
  createdBy: string;

  @Column({ type: 'varchar', length: 36, nullable: true, name: 'updated_by' })
  updatedBy: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
