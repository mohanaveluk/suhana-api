import { Module } from "@nestjs/common";
import { AuditRepository } from "./audit.repository";
import { AuditInterceptor } from "./audit.interceptor";
import { ClinicContext } from "../../common/context/clinic-context.provider";
import { CommonModule } from "src/common/common.module";
import { REQUEST } from "@nestjs/core";
import { Request } from 'express';

@Module({
  imports: [CommonModule],
  providers: [
    // AuditRepository,
    // {
    //   provide: AuditInterceptor,
    //   useFactory: (auditRepo: AuditRepository, request: Request) => {
    //     return new AuditInterceptor(auditRepo, request); // Pass the Request object
    //   },
    //   inject: [AuditRepository, REQUEST], // Inject the Request object
    // },
    AuditRepository,
    AuditInterceptor, // Register AuditInterceptor directly
  ],
  exports: [  AuditRepository, AuditInterceptor],
})
export class AuditModule {}