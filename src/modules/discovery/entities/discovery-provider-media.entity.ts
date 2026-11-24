import { BeforeInsert, Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { DiscoveryProvider } from './discovery-provider.entity';

/** Gallery image for a provider (uploaded by an admin to GCS). */
@Entity('discovery_provider_media')
@Index('IDX_DISCOVERY_PROVIDER_MEDIA_PROVIDER', ['providerId', 'displayOrder'])
export class DiscoveryProviderMedia {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id: string;

  @BeforeInsert()
  generateId(): void {
    if (!this.id) this.id = uuidv4();
  }

  @Column({ type: 'varchar', length: 36, name: 'provider_id' })
  providerId: string;

  @ManyToOne(() => DiscoveryProvider, (p) => p.media, { createForeignKeyConstraints: false })
  @JoinColumn({ name: 'provider_id' })
  provider: DiscoveryProvider;

  @Column({ type: 'varchar', length: 500 })
  url: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  caption: string | null;

  @Column({ type: 'int', name: 'display_order', default: 0 })
  displayOrder: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
