import { Column, CreateDateColumn, Entity, Index, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { BusinessHoursEntry, CertificationEntry } from './discovery-astrologer-detail.entity';

/**
 * Category-specific details for every category except astrologers (which has
 * discovery_astrologer_details). One row per (provider, category), so a
 * provider listed as both caterer and decorator keeps separate details.
 *
 * `attributes` is typed per category by CATEGORY_DEFINITIONS
 * (categories/category-definitions.ts) and sanitised on every write.
 */
@Entity('discovery_service_details')
@Index('IDX_DISCOVERY_SERVICE_DETAILS_CATEGORY', ['categoryId', 'experienceYears'])
export class DiscoveryServiceDetail {
  @PrimaryColumn({ type: 'varchar', length: 36, name: 'provider_id' })
  providerId: string;

  @PrimaryColumn({ type: 'int', name: 'category_id' })
  categoryId: number;

  @Column({ type: 'int', name: 'experience_years', nullable: true })
  experienceYears: number | null;

  /** Codes from the category's `specialties` list. */
  @Column({ type: 'json', nullable: true })
  specialties: string[] | null;

  @Column({ type: 'json', nullable: true })
  attributes: Record<string, number | boolean | string> | null;

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
