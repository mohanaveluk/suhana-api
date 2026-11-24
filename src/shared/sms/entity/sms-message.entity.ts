import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export enum SmsDeliveryStatus {
  /** Recorded, provider call not finished. */
  QUEUED = 'QUEUED',
  /** Provider accepted the request (this is NOT delivery). */
  ACCEPTED = 'ACCEPTED',
  /** Provider handed it to the carrier (webhook message.sent). */
  SENT = 'SENT',
  /** Carrier reported delivery to the handset (webhook message.finalized → delivered). */
  DELIVERED = 'DELIVERED',
  FAILED = 'FAILED',
  /** Carrier gave no final answer (delivery_unconfirmed). */
  UNKNOWN = 'UNKNOWN',
}

/**
 * One outbound SMS for delivery tracking and per-number rate limiting.
 * Deliberately stores NO message content (OTP codes never touch this table) and only a masked
 * number plus a SHA-256 of the full E.164 number (to count sends per number without keeping it).
 */
@Entity('sms_messages')
@Index('IDX_sms_messages_recipient_created', ['recipientHash', 'createdAt'])
@Index('IDX_sms_messages_user_created', ['userId', 'createdAt'])
export class SmsMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'varchar', length: 36, nullable: true })
  userId: string | null;

  @Column({ name: 'recipient_masked', type: 'varchar', length: 24 })
  recipientMasked: string;

  @Column({ name: 'recipient_hash', type: 'char', length: 64 })
  recipientHash: string;

  @Column({ name: 'sms_type', type: 'varchar', length: 40 })
  smsType: string;

  @Column({ type: 'varchar', length: 20 })
  provider: string;

  @Index('UQ_sms_messages_provider_message_id', { unique: true })
  @Column({ name: 'provider_message_id', type: 'varchar', length: 64, nullable: true })
  providerMessageId: string | null;

  @Column({ type: 'enum', enum: SmsDeliveryStatus, default: SmsDeliveryStatus.QUEUED })
  status: SmsDeliveryStatus;

  @Column({ name: 'error_code', type: 'varchar', length: 40, nullable: true })
  errorCode: string | null;

  /** Last processed webhook event id — makes webhook handling idempotent. */
  @Column({ name: 'last_event_id', type: 'varchar', length: 64, nullable: true })
  lastEventId: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
