import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Scope,
  Inject,
} from '@nestjs/common';
import { tap } from 'rxjs/operators';
import { AuditRepository } from './audit.repository';
import { ClinicContext } from '../../common/context/clinic-context.provider';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';

@Injectable({ scope: Scope.REQUEST })
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly auditRepo: AuditRepository,
    private readonly clinicContext: ClinicContext
  ) {}

  intercept(context: ExecutionContext, next: CallHandler) {
    const start = Date.now();
    const request = context.switchToHttp().getRequest();

    return next.handle().pipe(
      tap(async () => {

        await this.auditRepo.log({
          //clinicGuid: this.clinicContext.practiceGuid,
          accountGuid: this.clinicContext.accountGuid,
          apiName: 'OpenDental',
          method: request.method,
          endpoint: request.originalUrl,
          statusCode: 200,
          duration: Date.now() - start,
        });
      }),
    );
  }
}