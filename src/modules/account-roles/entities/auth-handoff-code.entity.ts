import { Column, CreateDateColumn, Entity, Index, PrimaryColumn } from 'typeorm';

/**
 * Single-use, short-lived code for switching between Aurora Matrimony and
 * Aurora for Providers without signing in again. Only the SHA-256 hash of the
 * code is stored; the code itself travels once in the target app's URL and is
 * exchanged (and burned) immediately.
 */
@Entity('auth_handoff_codes')
@Index('IDX_AUTH_HANDOFF_CODES_USER', ['userId'])
export class AuthHandoffCode {
  /** hex SHA-256 of the code. */
  @PrimaryColumn({ name: 'code_hash', type: 'char', length: 64 })
  codeHash: string;

  @Column({ name: 'user_id', type: 'varchar', length: 36 })
  userId: string;

  /** 'matrimony' | 'providers' */
  @Column({ type: 'varchar', length: 16 })
  target: string;

  @Column({ name: 'expires_at', type: 'datetime' })
  expiresAt: Date;

  @Column({ name: 'used_at', type: 'datetime', nullable: true })
  usedAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'datetime', precision: 6 })
  createdAt: Date;
}
