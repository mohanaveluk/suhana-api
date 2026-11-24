import {
  BeforeInsert, Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn, UpdateDateColumn,
} from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { DiscoveryProvider } from './discovery-provider.entity';
import { decimalTransformer } from './transformers';

/**
 * A provider's place of business (multiple per provider). Distance search uses
 * the B-tree index on (latitude, longitude) for a bounding-box range scan, then
 * Haversine on the survivors — see search/provider-search.query.ts.
 *
 * Postal codes are strings (leading zeros in US ZIPs). Country is ISO alpha-2.
 */
@Entity('discovery_locations')
@Index('IDX_DISCOVERY_LOCATIONS_GEO', ['latitude', 'longitude'])
@Index('IDX_DISCOVERY_LOCATIONS_PLACE', ['country', 'state', 'city'])
@Index('IDX_DISCOVERY_LOCATIONS_PROVIDER', ['providerId'])
export class DiscoveryLocation {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id: string;

  @BeforeInsert()
  generateId(): void {
    if (!this.id) this.id = uuidv4();
  }

  @Column({ type: 'varchar', length: 36, name: 'provider_id' })
  providerId: string;

  @ManyToOne(() => DiscoveryProvider, (p) => p.locations, { createForeignKeyConstraints: false })
  @JoinColumn({ name: 'provider_id' })
  provider: DiscoveryProvider;

  @Column({ type: 'varchar', length: 100, nullable: true })
  label: string | null;

  @Column({ type: 'varchar', length: 255, name: 'address_line1', nullable: true })
  addressLine1: string | null;

  @Column({ type: 'varchar', length: 255, name: 'address_line2', nullable: true })
  addressLine2: string | null;

  @Column({ type: 'varchar', length: 100 })
  city: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  state: string | null;

  @Column({ type: 'varchar', length: 12, name: 'postal_code', nullable: true })
  postalCode: string | null;

  @Column({ type: 'varchar', length: 2 })
  country: string;

  @Column({ type: 'decimal', precision: 9, scale: 6, nullable: true, transformer: decimalTransformer })
  latitude: number | null;

  @Column({ type: 'decimal', precision: 9, scale: 6, nullable: true, transformer: decimalTransformer })
  longitude: number | null;

  /**
   * When false (e.g. a home-based consultant), members see only city/state —
   * no street address and no directions link.
   */
  @Column({ type: 'boolean', name: 'show_street_address', default: true })
  showStreetAddress: boolean;

  @Column({ type: 'boolean', name: 'is_primary', default: false })
  isPrimary: boolean;

  @Column({ type: 'boolean', name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
