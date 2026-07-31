import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index,
} from 'typeorm';
import { ReplyStatus } from '../enums/testimonial.enums';

// Supports unlimited nesting via a self-referential parentReplyId. The tree is
// assembled in the service (a single flat fetch, then linked in memory) to
// avoid recursive SQL.
@Entity('review_reply')
export class ReviewReply {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_reply_review_id')
  @Column({ type: 'varchar', length: 36, name: 'review_id' })
  reviewId: string;

  @Index('IDX_reply_parent_id')
  @Column({ type: 'varchar', length: 36, name: 'parent_reply_id', nullable: true })
  parentReplyId: string | null;

  // Exactly one of userId / adminId is set depending on the author.
  @Column({ type: 'varchar', length: 36, name: 'user_id', nullable: true })
  userId: string | null;

  @Column({ type: 'varchar', length: 36, name: 'admin_id', nullable: true })
  adminId: string | null;

  @Column({ type: 'varchar', length: 2000, name: 'reply_text' })
  replyText: string;

  @Column({ type: 'enum', enum: ReplyStatus, default: ReplyStatus.APPROVED })
  status: ReplyStatus;

  @Column({ type: 'int', default: 0, name: 'like_count' })
  likeCount: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date | null;
}
