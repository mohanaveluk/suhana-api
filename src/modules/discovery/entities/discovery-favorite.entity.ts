import { BeforeInsert, Column, CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';

/** Member's saved provider. user_id is the account id (user.id). */
@Entity('discovery_favorites')
@Index('IDX_DISCOVERY_FAVORITES_USER_PROVIDER', ['userId', 'providerId'], { unique: true })
export class DiscoveryFavorite {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id: string;

  @BeforeInsert()
  generateId(): void {
    if (!this.id) this.id = uuidv4();
  }

  @Column({ type: 'varchar', length: 36, name: 'user_id' })
  userId: string;

  @Column({ type: 'varchar', length: 36, name: 'provider_id' })
  providerId: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
