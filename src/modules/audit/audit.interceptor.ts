import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, tap } from 'rxjs';
import { Request } from 'express';
import { AuditEmitter } from './audit.emitter';
import { AUDIT_METADATA_KEY, AuditOptions } from './decorators/audit.decorator';
import { extractRequestContext } from './helpers/request-context.util';

// Automatic, zero-touch audit logging for any handler decorated with @Audit().
// On a successful response it emits an audit event enriched with request context
// (user, ip, user-agent → device/platform). It NEVER throws into the request
// path — auditing failures must not break the API.
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly auditEmitter: AuditEmitter,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const options = this.reflector.get<AuditOptions>(
      AUDIT_METADATA_KEY,
      context.getHandler(),
    );

    // No @Audit() on this handler → passthrough untouched.
    if (!options) return next.handle();

    const req = context.switchToHttp().getRequest<Request>();
    const ctx = extractRequestContext(req);

    return next.handle().pipe(
      tap((response) => {
        try {
          const entityId = options.entityIdFrom
            ? resolvePath({ params: req.params, query: req.query, body: req.body, response }, options.entityIdFrom)
            : undefined;

          this.auditEmitter.emit({
            eventType: options.eventType,
            entityType: options.entityType,
            entityId: entityId != null ? String(entityId) : undefined,
            userId: ctx.userId,
            description: options.description,
            newValue: options.captureBody ? sanitize(req.body) : undefined,
            ipAddress: ctx.ipAddress,
            userAgent: ctx.userAgent,
            deviceType: ctx.deviceType,
            platform: ctx.platform,
          });
        } catch {
          // Swallow — never let audit capture affect the response.
        }
      }),
    );
  }
}

// Resolve a dotted path like "params.id" / "response.data.id" against a root.
function resolvePath(root: any, path: string): any {
  return path.split('.').reduce((acc, key) => (acc == null ? acc : acc[key]), root);
}

// Strip obviously-sensitive keys before a body is persisted as new_value.
const SENSITIVE_KEYS = new Set(['password', 'newPassword', 'currentPassword', 'token', 'resetToken', 'code', 'otp']);
function sanitize(body: any): Record<string, any> | undefined {
  if (!body || typeof body !== 'object') return undefined;
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(body)) {
    out[k] = SENSITIVE_KEYS.has(k) ? '[REDACTED]' : v;
  }
  return out;
}
