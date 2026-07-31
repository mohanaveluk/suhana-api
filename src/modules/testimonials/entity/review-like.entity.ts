import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  Unique,
} from 'typeorm';

// One like per (review, user). The unique constraint is the source of truth —
// the service also checks, but the DB guarantees no duplicates under races.
@Entity('review_like')
@Unique('UQ_review_like_review_user', ['reviewId', 'userId'])
export class ReviewLike {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_like_review_id')
  @Column({ type: 'varchar', length: 36, name: 'review_id' })
  reviewId: string;

  @Column({ type: 'varchar', length: 36, name: 'user_id' })
  userId: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
