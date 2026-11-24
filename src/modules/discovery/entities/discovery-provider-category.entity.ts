import { Column, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { DiscoveryProvider } from './discovery-provider.entity';
import { DiscoveryCategory } from './discovery-category.entity';

@Entity('discovery_provider_categories')
@Index('IDX_DISCOVERY_PROVIDER_CATEGORIES_CATEGORY', ['categoryId', 'providerId'])
export class DiscoveryProviderCategory {
  @PrimaryColumn({ type: 'varchar', length: 36, name: 'provider_id' })
  providerId: string;

  @PrimaryColumn({ type: 'int', name: 'category_id' })
  categoryId: number;

  @Column({ type: 'boolean', name: 'is_primary', default: false })
  isPrimary: boolean;

  @ManyToOne(() => DiscoveryProvider, (p) => p.categories, { createForeignKeyConstraints: false })
  @JoinColumn({ name: 'provider_id' })
  provider: DiscoveryProvider;

  @ManyToOne(() => DiscoveryCategory, { createForeignKeyConstraints: false, eager: false })
  @JoinColumn({ name: 'category_id' })
  category: DiscoveryCategory;
}
