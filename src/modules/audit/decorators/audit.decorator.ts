import { SetMetadata } from '@nestjs/common';
import { AuditEventType } from '../enums/audit-event-type.enum';
import { AuditEntityType } from '../enums/audit-entity-type.enum';

export const AUDIT_METADATA_KEY = 'audit:options';

export interface AuditOptions {
  eventType: AuditEventType;
  entityType?: AuditEntityType;
  description?: string;

  // How to resolve the affected entity id from the handler's context.
  // e.g. { entityIdFrom: 'params.id' } or { entityIdFrom: 'response.id' }.
  entityIdFrom?: string;

  // When true, the request body is captured as `new_value`. Off by default so
  // we never accidentally persist sensitive payloads (passwords, tokens).
  captureBody?: boolean;
}

// Marks a controller handler for automatic audit logging. The AuditInterceptor
// reads this metadata and emits an audit event on a successful (2xx) response —
// so handlers need zero audit code.
//
// @Audit({ eventType: AuditEventType.PROFILE_VIEWED, entityType: AuditEntityType.PROFILE,
//          entityIdFrom: 'params.id' })
export const Audit = (options: AuditOptions) =>
  SetMetadata(AUDIT_METADATA_KEY, options);
