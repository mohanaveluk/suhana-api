import {
  BeforeInsert, Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn, UpdateDateColumn,
} from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { DiscoveryProvider } from './discovery-provider.entity';
import { ConsultationMode } from '../constants/discovery.enums';
import { decimalTransformer } from './transformers';

/** A priced offering (e.g. "Kundli matching — video, 45 min, ₹1,500"). No payments. */
@Entity('discovery_services')
@Index('IDX_DISCOVERY_SERVICES_PROVIDER', ['providerId', 'isActive'])
export class DiscoveryService {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id: string;

  @BeforeInsert()
  generateId(): void {
    if (!this.id) this.id = uuidv4();
  }

  @Column({ type: 'varchar', length: 36, name: 'provider_id' })
  providerId: string;

  @ManyToOne(() => DiscoveryProvider, (p) => p.services, { createForeignKeyConstraints: false })
  @JoinColumn({ name: 'provider_id' })
  provider: DiscoveryProvider;

  @Column({ type: 'int', name: 'category_id' })
  categoryId: number;

  @Column({ type: 'varchar', length: 150 })
  name: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  specialization: string | null;

  @Column({ type: 'varchar', length: 16, name: 'consultation_mode' })
  consultationMode: ConsultationMode;

  /** Null = "price on request" — never shown as free. */
  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true, transformer: decimalTransformer })
  price: number | null;

  @Column({ type: 'varchar', length: 3, nullable: true })
  currency: string | null;

  @Column({ type: 'int', name: 'duration_minutes', nullable: true })
  durationMinutes: number | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  description: string | null;

  @Column({ type: 'boolean', name: 'is_active', default: true })
  isActive: boolean;

  @Column({ type: 'int', name: 'display_order', default: 0 })
  displayOrder: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
