import {
  BeforeInsert, Column, CreateDateColumn, DeleteDateColumn, Entity, Index, OneToMany, OneToOne,
  PrimaryColumn, UpdateDateColumn,
} from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { ProviderVerificationStatus } from '../constants/discovery.enums';
import { decimalTransformer } from './transformers';
import { DiscoveryLocation } from './discovery-location.entity';
import { DiscoveryProviderCategory } from './discovery-provider-category.entity';
import { DiscoveryService } from './discovery-service.entity';
import { DiscoveryProviderLanguage } from './discovery-provider-language.entity';
import { DiscoveryProviderMedia } from './discovery-provider-media.entity';
import { DiscoveryAstrologerDetail } from './discovery-astrologer-detail.entity';

/**
 * A listed business/person. Phase 1 listings are admin-managed (userId null);
 * userId exists so providers can claim/manage their own listing later.
 *
 * verificationStatus describes the BUSINESS LISTING only (identity/contact
 * checked by an admin). Qualifications are verified per certification, in the
 * category detail table — the two are shown separately in the UI.
 *
 * No DB-level foreign keys on discovery tables (same approach as
 * personality/profile_visits): integrity is enforced by the service layer.
 */
@Entity('discovery_providers')
@Index('IDX_DISCOVERY_PROVIDERS_VISIBILITY', ['isActive', 'verificationStatus', 'deletedAt'])
@Index('IDX_DISCOVERY_PROVIDERS_USER', ['userId'])
export class DiscoveryProvider {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id: string;

  @BeforeInsert()
  generateId(): void {
    if (!this.id) this.id = uuidv4();
  }

  @Column({ type: 'varchar', length: 36, name: 'user_id', nullable: true })
  userId: string | null;

  @Column({ type: 'varchar', length: 150, name: 'display_name' })
  displayName: string;

  @Column({ type: 'varchar', length: 150, name: 'business_name', nullable: true })
  businessName: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  headline: string | null;

  @Column({ type: 'text', nullable: true })
  about: string | null;

  @Column({ type: 'varchar', length: 500, name: 'photo_url', nullable: true })
  photoUrl: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  email: string | null;

  @Column({ type: 'varchar', length: 32, nullable: true })
  phone: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  website: string | null;

  @Column({ type: 'varchar', length: 16, name: 'verification_status', default: ProviderVerificationStatus.PENDING })
  verificationStatus: ProviderVerificationStatus;

  @Column({ type: 'varchar', length: 500, name: 'verification_notes', nullable: true })
  verificationNotes: string | null;

  @Column({ type: 'datetime', name: 'verified_at', nullable: true })
  verifiedAt: Date | null;

  @Column({ type: 'varchar', length: 36, name: 'verified_by', nullable: true })
  verifiedBy: string | null;

  @Column({ type: 'boolean', name: 'is_active', default: true })
  isActive: boolean;

  /** Whether the provider is currently taking new clients ("availability" in ranking). */
  @Column({ type: 'boolean', name: 'accepting_clients', default: true })
  acceptingClients: boolean;

  /** Aggregates over APPROVED reviews only — recomputed on every moderation change. */
  @Column({ type: 'decimal', precision: 3, scale: 2, name: 'rating_avg', nullable: true, transformer: decimalTransformer })
  ratingAvg: number | null;

  @Column({ type: 'int', name: 'rating_count', default: 0 })
  ratingCount: number;

  @Column({ type: 'varchar', length: 36, name: 'created_by', nullable: true })
  createdBy: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date | null;

  @OneToMany(() => DiscoveryLocation, (l) => l.provider)
  locations: DiscoveryLocation[];

  @OneToMany(() => DiscoveryProviderCategory, (c) => c.provider)
  categories: DiscoveryProviderCategory[];

  @OneToMany(() => DiscoveryService, (s) => s.provider)
  services: DiscoveryService[];

  @OneToMany(() => DiscoveryProviderLanguage, (l) => l.provider)
  languages: DiscoveryProviderLanguage[];

  @OneToMany(() => DiscoveryProviderMedia, (m) => m.provider)
  media: DiscoveryProviderMedia[];

  @OneToOne(() => DiscoveryAstrologerDetail, (d) => d.provider)
  astrologerDetail: DiscoveryAstrologerDetail | null;
}
