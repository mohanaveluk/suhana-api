import { Column, CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';
import { ProviderMemberRole } from '../constants/discovery.enums';

/**
 * Which user accounts may manage a listing (provider self-service).
 * Permission is per listing, not a global role, so one Aurora identity can be
 * a bride/groom member AND own a business. Admins never need a row here.
 */
@Entity('discovery_provider_members')
@Index('IDX_DISCOVERY_PROVIDER_MEMBERS_USER', ['userId'])
export class DiscoveryProviderMember {
  @PrimaryColumn({ type: 'varchar', length: 36, name: 'provider_id' })
  providerId: string;

  @PrimaryColumn({ type: 'varchar', length: 36, name: 'user_id' })
  userId: string;

  @Column({ type: 'varchar', length: 16, default: ProviderMemberRole.OWNER })
  role: ProviderMemberRole;

  /** Who granted access (the provider themself on self-registration, or the approving admin). */
  @Column({ type: 'varchar', length: 36, name: 'created_by', nullable: true })
  createdBy: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
