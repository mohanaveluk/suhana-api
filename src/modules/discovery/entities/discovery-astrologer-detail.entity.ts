import { Column, CreateDateColumn, Entity, Index, JoinColumn, OneToOne, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { DiscoveryProvider } from './discovery-provider.entity';

export interface BusinessHoursEntry {
  /** mon … sun */
  day: string;
  /** "09:00" (24h, provider's local time). */
  open: string;
  close: string;
}

export interface CertificationEntry {
  name: string;
  issuer?: string | null;
  year?: number | null;
  /**
   * True only when an admin has checked the credential itself. This is
   * independent of the listing's verificationStatus.
   */
  verified: boolean;
}

/** Astrologer-specific attributes (category detail table, 1:1 with provider). */
@Entity('discovery_astrologer_details')
@Index('IDX_DISCOVERY_ASTROLOGER_DETAILS_EXPERIENCE', ['experienceYears'])
export class DiscoveryAstrologerDetail {
  @PrimaryColumn({ type: 'varchar', length: 36, name: 'provider_id' })
  providerId: string;

  @OneToOne(() => DiscoveryProvider, (p) => p.astrologerDetail, { createForeignKeyConstraints: false })
  @JoinColumn({ name: 'provider_id' })
  provider: DiscoveryProvider;

  @Column({ type: 'int', name: 'experience_years', nullable: true })
  experienceYears: number | null;

  /** Codes from ASTROLOGER_SPECIALIZATIONS. */
  @Column({ type: 'json', nullable: true })
  specializations: string[] | null;

  @Column({ type: 'json', name: 'business_hours', nullable: true })
  businessHours: BusinessHoursEntry[] | null;

  @Column({ type: 'json', nullable: true })
  certifications: CertificationEntry[] | null;

  @Column({ type: 'varchar', length: 255, name: 'availability_note', nullable: true })
  availabilityNote: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
