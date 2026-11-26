import { BeforeInsert, Column, CreateDateColumn, Entity, Index, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { ClaimStatus } from '../constants/discovery.enums';

/**
 * "Claim this business": a provider account asks to manage an admin-created
 * listing. Nothing changes on the listing until an admin APPROVES the claim.
 */
@Entity('discovery_listing_claims')
@Index('IDX_DISCOVERY_LISTING_CLAIMS_STATUS', ['status', 'createdAt'])
@Index('IDX_DISCOVERY_LISTING_CLAIMS_PROVIDER', ['providerId', 'status'])
@Index('IDX_DISCOVERY_LISTING_CLAIMS_USER', ['userId'])
export class DiscoveryListingClaim {
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

  @Column({ type: 'varchar', length: 16, default: ClaimStatus.PENDING })
  status: ClaimStatus;

  /** How the claimant relates to the business, and how we can verify it. */
  @Column({ type: 'varchar', length: 1000, nullable: true })
  message: string | null;

  @Column({ type: 'varchar', length: 150, name: 'contact_name', nullable: true })
  contactName: string | null;

  @Column({ type: 'varchar', length: 32, name: 'contact_phone', nullable: true })
  contactPhone: string | null;

  @Column({ type: 'varchar', length: 255, name: 'business_email', nullable: true })
  businessEmail: string | null;

  @Column({ type: 'varchar', length: 500, name: 'admin_note', nullable: true })
  adminNote: string | null;

  @Column({ type: 'varchar', length: 36, name: 'reviewed_by', nullable: true })
  reviewedBy: string | null;

  @Column({ type: 'datetime', name: 'reviewed_at', nullable: true })
  reviewedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
