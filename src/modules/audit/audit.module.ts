import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLog } from './entity/audit-log.entity';
import { AuditLogService } from './audit-log.service';
import { RiskScoringEngine } from './risk-scoring.engine';
import { AuditEmitter } from './audit.emitter';
import { AuditLogListener } from './audit-log.listener';
import { AuditInterceptor } from './audit.interceptor';
import { AuditLogController } from './audit-log.controller';
import { AdminAuditLogController } from './admin-audit-log.controller';
import { LogModule } from '../logger/log.module';

// Audit Log & User Risk Monitoring.
//
// Producers emit an `audit.log` event — via the @Audit() decorator (captured by
// AuditInterceptor) or via AuditEmitter from inside a service. AuditLogListener
// consumes the event and persists through AuditLogService, so no producer ever
// touches the repository or blocks on logging.
//
// Requires EventEmitterModule.forRoot() to be registered once at the app root.
@Module({
  imports: [TypeOrmModule.forFeature([AuditLog]), LogModule],
  controllers: [AuditLogController, AdminAuditLogController],
  providers: [
    AuditLogService,
    RiskScoringEngine,
    AuditEmitter,
    AuditLogListener,
    AuditInterceptor,
  ],
  // Exported so other feature modules can emit domain audit events and reuse
  // the interceptor / query service.
  exports: [AuditEmitter, AuditInterceptor, AuditLogService],
})
export class AuditModule {}
