import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  UpdateDateColumn, ManyToOne, JoinColumn, Index,
} from 'typeorm';
import { User } from '../../user/entity/user.entity';

export enum EmailType {
  INTEREST_SENT           = 'INTEREST_SENT',
  INTEREST_ACCEPTED       = 'INTEREST_ACCEPTED',
  INTEREST_REJECTED       = 'INTEREST_REJECTED',
  OFFLINE_MESSAGE_SENT    = 'OFFLINE_MESSAGE_SENT',
  PARTNER_RECOMMENDATION  = 'PARTNER_RECOMMENDATION',
  PROFILE_VIEWED          = 'PROFILE_VIEWED',
  PASSWORD_RESET          = 'PASSWORD_RESET',
  SYSTEM_NOTIFICATION     = 'SYSTEM_NOTIFICATION',
  EMAIL_VERIFICATION      = 'EMAIL_VERIFICATION',
  LOGIN_OTC               = 'LOGIN_OTC',
}

export enum EmailStatus {
  SENT   = 'SENT',
  FAILED = 'FAILED',
  PENDING = 'PENDING',
}

@Entity('email_history')
export class EmailHistory {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  @Index()
  @Column({ type: 'varchar', length: 100 })
  guid: string;

  @Column({ type: 'varchar', length: 50 })
  emailType: string;

  // Nullable because system-generated emails (e.g. registration) have no fromUser
  @Index()
  @Column({ type: 'varchar', length: 36, nullable: true, name: 'from_user_id' })
  fromUserId: string;

  @Index()
  @Column({ type: 'varchar', length: 36, nullable: true, name: 'to_user_id' })
  toUserId: string;

  @Column({ type: 'varchar', length: 255 })
  fromEmail: string;

  @Column({ type: 'varchar', length: 255 })
  toEmail: string;

  @Column({ type: 'text', nullable: true })
  ccEmail: string;

  @Column({ type: 'varchar', length: 500 })
  subject: string;

  @Column({ type: 'longtext' })
  htmlContent: string;

  @Column({ type: 'varchar', length: 50, default: EmailStatus.PENDING })
  status: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  provider: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  providerMessageId: string;

  @Column({ type: 'datetime', nullable: true })
  sentAt: Date;

  @Column({ type: 'datetime', nullable: true })
  openedAt: Date;

  @Column({ type: 'datetime', nullable: true })
  readAt: Date;

  @Column({ type: 'json', nullable: true })
  metadata: Record<string, any>;

  @Column({ type: 'varchar', length: 36, nullable: true, name: 'created_by' })
  createdBy: string;

  @ManyToOne(() => User, { nullable: true, eager: false, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'from_user_id' })
  fromUser: User;

  @ManyToOne(() => User, { nullable: true, eager: false, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'to_user_id' })
  toUser: User;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
