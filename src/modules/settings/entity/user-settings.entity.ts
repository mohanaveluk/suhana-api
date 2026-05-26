import {
  Entity, PrimaryGeneratedColumn, Column,
  OneToOne, JoinColumn, CreateDateColumn, UpdateDateColumn,
} from 'typeorm';
import { User } from '../../user/entity/user.entity';

@Entity('user_settings')
export class UserSettings {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // ── Relation ──────────────────────────────────────────────────────────────
  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ name: 'user_id' })
  userId: string;

  // ── Email Notifications ───────────────────────────────────────────────────
  @Column({ default: true })
  emailMatches: boolean;

  @Column({ default: true })
  emailMessages: boolean;

  @Column({ default: true })
  emailInterests: boolean;

  @Column({ default: false })
  emailMarketing: boolean;

  // ── Push & SMS ────────────────────────────────────────────────────────────
  @Column({ default: false })
  smsAlerts: boolean;

  @Column({ default: true })
  pushMatches: boolean;

  @Column({ default: true })
  pushMessages: boolean;

  // ── Privacy & Visibility ──────────────────────────────────────────────────
  @Column({ default: true })
  showOnlineStatus: boolean;

  @Column({ default: true })
  showReadReceipts: boolean;

  @Column({ default: true })
  profileIndexed: boolean;

  @Column({
    type: 'enum',
    enum: ['everyone', 'matches', 'none'],
    default: 'everyone',
  })
  allowMessageFrom: 'everyone' | 'matches' | 'none';

  // ── Timestamps ────────────────────────────────────────────────────────────
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
