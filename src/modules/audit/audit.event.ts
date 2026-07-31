import { AuditEventType } from './enums/audit-event-type.enum';
import { AuditEntityType } from './enums/audit-entity-type.enum';

// The single event name every audit producer emits under.
export const AUDIT_EVENT = 'audit.log';

// Payload emitted whenever a meaningful action occurs. Producers (the
// interceptor or domain services) fill what they know; the listener/service
// derives changed_fields + risk before persisting.
export interface AuditEventPayload {
  eventType: AuditEventType;
  entityType?: AuditEntityType;
  entityId?: string;

  userId?: string;
  profileId?: string;

  // Snapshots for change detection. When both are present, the service derives
  // `changedFields`. Either may be omitted (e.g. pure "action" events).
  oldValue?: Record<string, any> | null;
  newValue?: Record<string, any> | null;
  // Explicit override — when a producer already knows the changed fields.
  changedFields?: string[];

  description?: string;

  // Request context — populated by the interceptor, optional for domain events.
  ipAddress?: string;
  userAgent?: string;
  deviceType?: string;
  platform?: string;
  country?: string;
  state?: string;
  city?: string;
}
