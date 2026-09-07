import {
  BeforeInsert, Column, CreateDateColumn, Entity, Index, JoinColumn,
  ManyToOne, PrimaryColumn, UpdateDateColumn,
} from 'typeorm';
import { v4 as uuidv4 } from 'uuid';

import { User } from '../../user/entity/user.entity';
import { Profile } from '../../user/entity/profile.entity';

/**
 * One row per (visitor, visited profile) pair.
 *
 * Re-visiting the same profile updates `visitCount` and `lastVisitedAt` in
 * place rather than inserting a new row — see the unique index below — so this
 * table stays roughly `active members × profiles they browse` in size, and the
 * "Recently Visited" list is a single indexed scan.
 *
 * Removal from the list is a soft delete (`isDeleted`), so a member who clears
 * an entry and later re-visits resumes the same counter.
 */
@Entity('profile_visits')
@Index('IDX_PROFILE_VISITS_VISITOR', ['visitorUserId'])
@Index('IDX_PROFILE_VISITS_VISITED_PROFILE', ['visitedProfileId'])
// Drives GET /profile-visits/recent: filter by visitor, order by recency.
@Index('IDX_PROFILE_VISITS_VISITOR_RECENT', ['visitorUserId', 'isDeleted', 'lastVisitedAt'])
// One row per visitor/profile pair — the whole de-duplication guarantee.
@Index('UQ_PROFILE_VISITS_VISITOR_PROFILE', ['visitorUserId', 'visitedProfileId'], { unique: true })
export class ProfileVisit {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id: string;

  @BeforeInsert()
  generateId(): void {
    if (!this.id) this.id = uuidv4();
  }

  // ── Visitor ────────────────────────────────────────────────────────────────

  @Column({ type: 'varchar', length: 36, name: 'visitor_user_id' })
  visitorUserId: string;

  @ManyToOne(() => User, { eager: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'visitor_user_id' })
  visitorUser: User;

  // ── Visited profile ────────────────────────────────────────────────────────

  @Column({ type: 'varchar', length: 36, name: 'visited_profile_id' })
  visitedProfileId: string;

  @ManyToOne(() => Profile, { eager: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'visited_profile_id' })
  visitedProfile: Profile;

  /**
   * Owner of `visitedProfile`. Denormalised on purpose: the self-visit guard
   * and the "recently viewed + match status" join both need it, and neither
   * should pay for a profiles join to get it.
   */
  @Column({ type: 'varchar', length: 36, name: 'visited_user_id' })
  visitedUserId: string;

  @ManyToOne(() => User, { eager: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'visited_user_id' })
  visitedUser: User;

  // ── Visit tracking ─────────────────────────────────────────────────────────

  @Column({ type: 'int', unsigned: true, default: 1, name: 'visit_count' })
  visitCount: number;

  @Column({ type: 'datetime', name: 'first_visited_at' })
  firstVisitedAt: Date;

  @Column({ type: 'datetime', name: 'last_visited_at' })
  lastVisitedAt: Date;

  // ── Soft delete ────────────────────────────────────────────────────────────

  @Column({ type: 'boolean', default: false, name: 'is_deleted' })
  isDeleted: boolean;

  @Column({ type: 'datetime', nullable: true, name: 'deleted_at' })
  deletedAt: Date | null;

  // ── Audit ──────────────────────────────────────────────────────────────────

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
