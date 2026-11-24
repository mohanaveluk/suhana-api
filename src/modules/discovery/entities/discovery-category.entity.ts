import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { DiscoveryCategoryKind } from '../constants/discovery.enums';

/**
 * A discovery category (astrologer, marriage hall, …). Categories drive the
 * engine: the search/detail pipeline looks up a CategoryHandler by slug.
 * Inactive categories are shown to members as "Coming soon".
 */
@Entity('discovery_categories')
@Index('IDX_DISCOVERY_CATEGORIES_SLUG', ['slug'], { unique: true })
export class DiscoveryCategory {
  @PrimaryGeneratedColumn({ type: 'int' })
  id: number;

  @Column({ type: 'varchar', length: 64 })
  slug: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  description: string | null;

  @Column({ type: 'int', name: 'parent_id', nullable: true })
  parentId: number | null;

  @Column({ type: 'varchar', length: 16, default: DiscoveryCategoryKind.SERVICE })
  kind: DiscoveryCategoryKind;

  /** Material icon name used by the UI. */
  @Column({ type: 'varchar', length: 64, nullable: true })
  icon: string | null;

  /** Tile image path (frontend-relative, e.g. /discover/astrologer.webp) or absolute URL. */
  @Column({ type: 'varchar', length: 255, name: 'image_url', nullable: true })
  imageUrl: string | null;

  @Column({ type: 'boolean', name: 'is_active', default: false })
  isActive: boolean;

  @Column({ type: 'int', name: 'display_order', default: 0 })
  displayOrder: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
