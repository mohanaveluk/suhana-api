import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LogModule } from 'src/modules/logger/log.module';
import { CustomLoggerService } from 'src/modules/logger/custom-logger.service';
import { SmsService } from './sms.service';
import { readSmsConfig } from './sms.config';
import { SMS_PROVIDER, SmsProvider } from './sms.types';
import { TelnyxSmsProvider } from './providers/telnyx-sms.provider';
import { LogSmsProvider } from './providers/log-sms.provider';
import { SmsMessage } from './entity/sms-message.entity';
import { SmsWebhookService } from './sms-webhook.service';
import { SmsWebhookController } from './sms-webhook.controller';
import { AdminSmsSettingsController } from './admin-sms-settings.controller';
import { AppSettingsModule } from '../app-settings/app-settings.module';
import { AuditModule } from 'src/modules/audit/audit.module';

/** Picks the provider once at start-up: Telnyx → dev log-only → disabled (null). */
export function smsProviderFactory(logger: CustomLoggerService): SmsProvider | null {
  const cfg = readSmsConfig();
  if (cfg.telnyxEnabled) {
    const telnyx = new TelnyxSmsProvider(cfg, logger);
    return telnyx.enabled ? telnyx : null; // misconfigured → disabled, never a crash
  }
  return cfg.logOnly ? new LogSmsProvider() : null;
}

@Module({
  imports: [LogModule, TypeOrmModule.forFeature([SmsMessage]), AppSettingsModule, AuditModule],
  controllers: [SmsWebhookController, AdminSmsSettingsController],
  providers: [
    { provide: SMS_PROVIDER, useFactory: smsProviderFactory, inject: [CustomLoggerService] },
    SmsService,
    SmsWebhookService,
  ],
  exports: [SmsService],
})
export class SmsModule {}
