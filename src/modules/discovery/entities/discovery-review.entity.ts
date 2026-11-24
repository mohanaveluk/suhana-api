import { BeforeInsert, Column, CreateDateColumn, Entity, Index, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { DiscoveryReviewStatus } from '../constants/discovery.enums';

/**
 * Member review of a provider. One per member per provider (unique index).
 * Only APPROVED reviews are public or counted in the provider's rating.
 */
@Entity('discovery_reviews')
@Index('IDX_DISCOVERY_REVIEWS_PROVIDER_USER', ['providerId', 'userId'], { unique: true })
@Index('IDX_DISCOVERY_REVIEWS_STATUS', ['status', 'createdAt'])
export class DiscoveryReview {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id: string;

  @BeforeInsert()
  generateId(): void {
    if (!this.id) this.id = uuidv4();
  }

  @Column({ type: 'varchar', length: 36, name: 'provider_id' })
  providerId: string;

  @Column({ type: 'varchar', length: 36, name: 'user_id' })
  userId: string;

  @Column({ type: 'tinyint' })
  rating: number;

  @Column({ type: 'varchar', length: 150, nullable: true })
  title: string | null;

  @Column({ type: 'text' })
  comment: string;

  @Column({ type: 'varchar', length: 16, default: DiscoveryReviewStatus.PENDING })
  status: DiscoveryReviewStatus;

  @Column({ type: 'varchar', length: 500, name: 'moderation_note', nullable: true })
  moderationNote: string | null;

  @Column({ type: 'varchar', length: 36, name: 'moderated_by', nullable: true })
  moderatedBy: string | null;

  @Column({ type: 'datetime', name: 'moderated_at', nullable: true })
  moderatedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
