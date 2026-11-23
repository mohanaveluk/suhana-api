import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Index, UpdateDateColumn,
} from 'typeorm';
import { User } from '../../user/entity/user.entity';

/** Where the sender found the profile when expressing interest (reporting only — never gates sending). */
export const INTEREST_SOURCES = [
  'PROFILE_VIEW',
  'PROFILE_SEARCH',
  'AI_MATCH',
  'HOROSCOPE_MATCH',
  'PERSONALITY_MATCH',
  'RECOMMENDED_PROFILE',
  'FEATURED_PROFILE',
  'MY_INTERESTS',
  'OTHER',
] as const;
export type InterestSource = (typeof INTEREST_SOURCES)[number];

/**
 * Lifecycle:  pending ──accept──► accepted
 *                    ├─decline──► declined
 *                    └─withdraw─► withdrawn   (by the sender; row kept as history)
 * Answered rows are never deleted or reset; every transition is also written to the audit log.
 * (Migration 1784334200000 adds withdrawn/isRead/readAt/respondedAt/withdrawnAt/source/updatedAt.)
 */
@Entity('interests')
@Index('IDX_interests_to_created', ['toUserId', 'createdAt'])
@Index('IDX_interests_from_created', ['fromUserId', 'createdAt'])
@Index('IDX_interests_status', ['status'])
export class Interest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  fromUserId: string;

  @ManyToOne(() => User, { eager: false })
  @JoinColumn({ name: 'fromUserId' })
  fromUser: User;

  @Column()
  toUserId: string;

  @ManyToOne(() => User, { eager: false })
  @JoinColumn({ name: 'toUserId' })
  toUser: User;

  @Column({ type: 'text', nullable: true })
  message: string;

  @Column({
    type: 'enum',
    enum: ['pending', 'accepted', 'declined', 'withdrawn'],
    default: 'pending',
  })
  status: string;

  @Column({ type: 'datetime', nullable: true })
  acceptedOn: Date;

  /** Recipient has opened this interest (dashboard "New" → "Viewed"). */
  @Column({ type: 'boolean', default: false })
  isRead: boolean;

  @Column({ type: 'datetime', nullable: true })
  readAt: Date | null;

  @Column({ type: 'datetime', nullable: true })
  respondedAt: Date | null;

  @Column({ type: 'datetime', nullable: true })
  withdrawnAt: Date | null;

  @Column({ type: 'varchar', length: 32, nullable: true })
  source: InterestSource | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @Column({type: 'uuid', nullable: true})
  guid: string;
}
