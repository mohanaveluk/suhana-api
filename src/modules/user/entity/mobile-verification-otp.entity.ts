import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  UpdateDateColumn, ManyToOne, JoinColumn, Generated, Index,
} from 'typeorm';
import { User } from './user.entity';
import { MobileVerificationStatus } from '../enums/mobile-verification-status.enum';

// One issued mobile-verification OTP.
//
// Append-only in spirit: a row is never reused across sends. Requesting a new
// code expires every outstanding PENDING row for that user and inserts a fresh
// one, so at most one PENDING row per user exists at any moment.
//
// otpCode holds a bcrypt hash, never the plaintext code — a database read must
// not be enough to take over a mobile number.
@Entity('mobile_verification_otp')
@Index('IDX_MVO_USER_STATUS', ['userId', 'status'])
@Index('IDX_MVO_MOBILE_STATUS', ['mobileNumber', 'status'])
@Index('IDX_MVO_USER_CREATED', ['userId', 'createdAt'])
export class MobileVerificationOtp {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  @Generated('uuid')
  guid: string;

  @Column({ type: 'varchar', length: 36, name: 'user_id' })
  userId: string;

  @ManyToOne(() => User, { eager: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  // The number this code was issued for, normalised to E.164.
  @Column({ type: 'varchar', length: 20, name: 'mobile_number' })
  mobileNumber: string;

  // bcrypt hash of the 6-digit code — never the code itself.
  @Column({ type: 'varchar', length: 255, name: 'otp_code' })
  otpCode: string;

  @Column({
    type: 'enum',
    enum: MobileVerificationStatus,
    default: MobileVerificationStatus.PENDING,
  })
  status: MobileVerificationStatus;

  // Failed verification attempts against this row. Capped by MAX_ATTEMPTS.
  @Column({ type: 'int', name: 'attempt_count', default: 0 })
  attemptCount: number;

  @Column({ type: 'datetime', name: 'expires_at' })
  expiresAt: Date;

  @Column({ type: 'datetime', name: 'verified_at', nullable: true })
  verifiedAt: Date | null;

  // ── Verification audit trail ───────────────────────────────────────────────
  @Column({ type: 'datetime', name: 'sent_at', nullable: true })
  sentAt: Date | null;

  @Column({ type: 'varchar', length: 64, name: 'ip_address', nullable: true })
  ipAddress: string | null;

  @Column({ type: 'varchar', length: 512, name: 'user_agent', nullable: true })
  userAgent: string | null;

  @Column({ type: 'varchar', length: 36, name: 'created_by', nullable: true })
  createdBy: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
