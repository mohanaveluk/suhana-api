// src/modules/auth/entity/login-otc.entity.ts

import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';

// Stores short-lived one-time codes issued for passwordless (email) login.
// Kept in its own table — separate from password_reset_tokens — so a login
// code can never be consumed by the password-reset flow and vice versa.
@Entity('login_otc_tokens')
export class LoginOtc {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // The email the login code was issued for — indexed for fast lookups
  @Index()
  @Column({ type: 'varchar', length: 255 })
  email: string;

  // Bcrypt hash of the 6-digit code — never store the plaintext code
  @Column({ type: 'varchar', length: 255 })
  codeHash: string;

  // Code expiry — checked on every validation
  @Column({ type: 'timestamp' })
  expiresAt: Date;

  // Marks the code as consumed after a successful login — prevents replay
  @Column({ type: 'boolean', default: false })
  used: boolean;

  @CreateDateColumn()
  createdAt: Date;
}
