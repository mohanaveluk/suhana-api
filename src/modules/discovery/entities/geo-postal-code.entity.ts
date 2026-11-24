import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { decimalTransformer } from './transformers';

/**
 * Postal-code centroids imported from the GeoNames postal code dataset
 * (CC BY 4.0, https://download.geonames.org/export/zip/). Loaded by
 * scripts/import-geonames-postal-codes.js — see docs/aurora-discover.md.
 *
 * Not unique per (country, postal_code): an Indian PIN maps to several post
 * offices, so lookups average the matching rows.
 */
@Entity('geo_postal_codes')
@Index('IDX_GEO_POSTAL_CODES_LOOKUP', ['countryCode', 'postalCode'])
@Index('IDX_GEO_POSTAL_CODES_PLACE', ['countryCode', 'placeName'])
@Index('IDX_GEO_POSTAL_CODES_ADMIN1', ['countryCode', 'adminName1'])
export class GeoPostalCode {
  @PrimaryGeneratedColumn({ type: 'int' })
  id: number;

  @Column({ type: 'varchar', length: 2, name: 'country_code' })
  countryCode: string;

  @Column({ type: 'varchar', length: 20, name: 'postal_code' })
  postalCode: string;

  @Column({ type: 'varchar', length: 180, name: 'place_name' })
  placeName: string;

  /** State (US) / state or UT (IN). */
  @Column({ type: 'varchar', length: 100, name: 'admin_name1', nullable: true })
  adminName1: string | null;

  @Column({ type: 'varchar', length: 20, name: 'admin_code1', nullable: true })
  adminCode1: string | null;

  /** County (US) / district (IN). */
  @Column({ type: 'varchar', length: 100, name: 'admin_name2', nullable: true })
  adminName2: string | null;

  @Column({ type: 'decimal', precision: 9, scale: 6, transformer: decimalTransformer })
  latitude: number;

  @Column({ type: 'decimal', precision: 9, scale: 6, transformer: decimalTransformer })
  longitude: number;
}
