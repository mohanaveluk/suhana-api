import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { AccountRole } from '../account-role.enum';

/** One application role held by one Aurora user (user.id). See AccountRole. */
@Entity('user_account_roles')
@Unique('UQ_USER_ACCOUNT_ROLES_USER_ROLE', ['userId', 'role'])
@Index('IDX_USER_ACCOUNT_ROLES_USER', ['userId'])
export class UserAccountRole {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  @Column({ name: 'user_id', type: 'varchar', length: 36 })
  userId: string;

  @Column({ type: 'varchar', length: 32 })
  role: AccountRole;

  /** AccountRoleSource — how the role was granted. */
  @Column({ type: 'varchar', length: 40 })
  source: string;

  @Column({ name: 'granted_by', type: 'varchar', length: 36, nullable: true })
  grantedBy: string | null;

  @CreateDateColumn({ name: 'granted_at', type: 'datetime', precision: 6 })
  grantedAt: Date;
}
