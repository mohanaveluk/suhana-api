import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { AUDIT_EVENT, AuditEventPayload } from './audit.event';
import { AuditLogService } from './audit-log.service';

// Bridges the event bus to persistence. Runs asynchronously (`async: true`) so
// logging never blocks the request that produced the event, and its errors are
// contained inside AuditLogService.logEvent (which never throws).
@Injectable()
export class AuditLogListener {
  constructor(private readonly auditLogService: AuditLogService) {}

  @OnEvent(AUDIT_EVENT, { async: true })
  async handleAuditEvent(payload: AuditEventPayload): Promise<void> {
    await this.auditLogService.logEvent(payload);
  }
}
