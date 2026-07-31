import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { AuditEventType } from '../enums/audit-event-type.enum';
import { AuditEntityType } from '../enums/audit-entity-type.enum';
import { RiskLevel } from '../enums/risk-level.enum';

// Immutable, append-only record of a meaningful user action.
// Composite indexes back the hot query paths: per-user history/timeline and
// admin filtering by event/entity/risk over a time window.
@Entity('audit_log')
@Index('IDX_audit_user_created', ['userId', 'createdAt'])
@Index('IDX_audit_user_event', ['userId', 'eventType'])
@Index('IDX_audit_event_created', ['eventType', 'createdAt'])
@Index('IDX_audit_risk_created', ['riskLevel', 'createdAt'])
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Actor — the user who performed the action.
  @Index('IDX_audit_user_id')
  @Column({ type: 'varchar', length: 36, name: 'user_id', nullable: true })
  userId: string | null;

  // The actor's profile (when applicable / resolvable).
  @Column({ type: 'varchar', length: 36, name: 'profile_id', nullable: true })
  profileId: string | null;

  @Index('IDX_audit_event_type')
  @Column({ type: 'varchar', length: 60, name: 'event_type' })
  eventType: AuditEventType;

  @Index('IDX_audit_entity_type')
  @Column({ type: 'varchar', length: 40, name: 'entity_type', nullable: true })
  entityType: AuditEntityType | null;

  // The specific record affected (e.g. the viewed profile id, the interest id).
  @Column({ type: 'varchar', length: 64, name: 'entity_id', nullable: true })
  entityId: string | null;

  @Column({ type: 'json', name: 'old_value', nullable: true })
  oldValue: Record<string, any> | null;

  @Column({ type: 'json', name: 'new_value', nullable: true })
  newValue: Record<string, any> | null;

  @Column({ type: 'json', name: 'changed_fields', nullable: true })
  changedFields: string[] | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  description: string | null;

  // ── Request context ────────────────────────────────────────────────────
  @Column({ type: 'varchar', length: 45, name: 'ip_address', nullable: true })
  ipAddress: string | null;

  @Column({ type: 'varchar', length: 512, name: 'user_agent', nullable: true })
  userAgent: string | null;

  @Column({ type: 'varchar', length: 20, name: 'device_type', nullable: true })
  deviceType: string | null;

  @Column({ type: 'varchar', length: 40, nullable: true })
  platform: string | null;

  // ── Geo (best-effort) ────────────────────────────────────────────────────
  @Column({ type: 'varchar', length: 80, nullable: true })
  country: string | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  state: string | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  city: string | null;

  // ── Risk ───────────────────────────────────────────────────────────────
  // Per-event base risk contribution (0-100). Aggregate analysis lives in the
  // risk-analysis endpoint; this column enables fast risk-level filtering.
  @Column({ type: 'int', name: 'risk_score', default: 0 })
  riskScore: number;

  @Index('IDX_audit_risk_level')
  @Column({ type: 'varchar', length: 10, name: 'risk_level', default: RiskLevel.LOW })
  riskLevel: RiskLevel;

  @Index('IDX_audit_created_at')
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
