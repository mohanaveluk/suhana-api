import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AUDIT_EVENT, AuditEventPayload } from './audit.event';

// Thin, injectable façade over the event bus. Domain services depend on THIS
// (not on AuditLogService) so producers stay decoupled from persistence, and
// emitting an audit event is a single fire-and-forget call.
//
// Use this when you need change-detection (pass old/new snapshots) or want to
// log an action from deep inside a service. For plain controller actions,
// prefer the @Audit() decorator — no code needed in the handler.
@Injectable()
export class AuditEmitter {
  constructor(private readonly eventEmitter: EventEmitter2) {}

  emit(payload: AuditEventPayload): void {
    // emitAsync is intentionally not awaited by callers — auditing must never
    // block or fail the originating request. The listener handles its own errors.
    this.eventEmitter.emit(AUDIT_EVENT, payload);
  }
}
