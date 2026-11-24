import { Inject, Injectable, OnModuleInit, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createHash } from 'crypto';
import { CustomLoggerService } from 'src/modules/logger/custom-logger.service';
import { readSmsConfig } from './sms.config';
import { SmsDeliveryStatus, SmsMessage } from './entity/sms-message.entity';
import { SMS_PROVIDER, SendSmsOptions, SmsProvider, SmsSendResult, maskPhone } from './sms.types';
import { AppSettingsService } from '../app-settings/app-settings.service';
import { APP_SETTING } from '../app-settings/app-settings.keys';

export type { SendSmsOptions, SmsSendResult } from './sms.types';

/**
 * Outbound SMS for the whole app. Callers never see the provider (Telnyx today) — they get a
 * standardised SmsSendResult. Never throws, never reports success unless a provider accepted
 * the message, and never logs or stores message content in production.
 */
@Injectable()
export class SmsService implements OnModuleInit {
  constructor(
    @Inject(SMS_PROVIDER) @Optional() private readonly provider: SmsProvider | null,
    private readonly logger: CustomLoggerService,
    @InjectRepository(SmsMessage) @Optional() private readonly messages?: Repository<SmsMessage>,
    @Optional() private readonly settings?: AppSettingsService,
  ) {}

  onModuleInit(): void {
    const cfg = readSmsConfig();
    if (cfg.telnyxEnabled && !this.provider?.enabled) {
      this.logger.warn(
        'TELNYX_ENABLED=true but TELNYX_API_KEY / TELNYX_FROM_NUMBER (E.164) are missing or invalid — SMS is disabled; OTPs fall back to email.',
      );
    } else if (this.provider?.name === 'telnyx') {
      this.logger.log(`SMS: Telnyx enabled (from ${maskPhone(cfg.fromNumber)})`);
    } else if (this.provider?.name === 'log') {
      this.logger.log('SMS: log-only mode (development) — messages are logged, not sent');
    } else {
      this.logger.log('SMS: disabled — OTPs are delivered by email');
    }
  }

  /** Site-wide admin switch (app_settings.sms_sending_enabled). Defaults to on when unset. */
  async isSendingEnabled(): Promise<boolean> {
    return this.settings ? this.settings.getBoolean(APP_SETTING.SMS_SENDING_ENABLED) : true;
  }

  /** A provider is configured AND the admin switch is on — i.e. send() can succeed right now. */
  async isAvailable(): Promise<boolean> {
    return this.isConfigured && (await this.isSendingEnabled());
  }

  /** A real provider (not log-only) is configured AND the admin switch is on. */
  async canDeliverNow(): Promise<boolean> {
    return this.canDeliver && (await this.isSendingEnabled());
  }

  /** Name of the active provider ('telnyx' | 'log'), or null when none is configured. */
  get providerName(): string | null {
    return this.provider?.enabled ? this.provider.name : null;
  }

  /** True when a real provider can deliver SMS (log-only does not count). */
  get canDeliver(): boolean {
    return !!this.provider?.enabled && this.provider.name !== 'log';
  }

  /** True when send() can succeed at all (real provider, or log-only in development). */
  get isConfigured(): boolean {
    return !!this.provider?.enabled;
  }

  async send(options: SendSmsOptions): Promise<SmsSendResult> {
    const smsType = options.smsType ?? 'GENERIC';
    if (!this.provider?.enabled) {
      return { success: false, errorCode: 'SMS_DISABLED', errorMessage: 'No SMS provider configured' };
    }
    if (!(await this.isSendingEnabled())) {
      this.logger.log(`SMS skipped [${smsType}] to ${maskPhone(options.to)}: sending is turned off site-wide (admin setting)`);
      return { success: false, provider: this.provider.name, errorCode: 'SMS_DISABLED', errorMessage: 'SMS sending is turned off by an administrator' };
    }

    const record = await this.track(options, smsType);
    let result: SmsSendResult;
    try {
      result = await this.provider.send(options.to, options.body);
    } catch (error: any) {
      // Providers are expected to return results, but never let a bug escape to the caller.
      result = { success: false, provider: this.provider.name, errorCode: 'UNKNOWN', errorMessage: error?.message };
    }

    if (result.success) {
      this.logger.log(`SMS accepted [${smsType}] to ${maskPhone(options.to)} via ${result.provider}${result.messageId ? ` (${result.messageId})` : ''}`);
    } else {
      this.logger.warn(`SMS not sent [${smsType}] to ${maskPhone(options.to)}: ${result.errorCode} — ${result.errorMessage ?? ''}`);
    }
    await this.finishTracking(record, result);
    return result;
  }

  /** Backward-compatible boolean form (true only when a provider accepted the message). */
  async sendSms(options: SendSmsOptions): Promise<boolean> {
    return (await this.send(options)).success;
  }

  /** SMS sent to a number in the last `minutes` (all accounts) — for per-number abuse limits. */
  async countRecentToNumber(to: string, minutes: number): Promise<number> {
    if (!this.messages) return 0;
    try {
      return await this.messages.createQueryBuilder('m')
        .where('m.recipientHash = :h', { h: this.hash(to) })
        .andWhere('m.createdAt >= :since', { since: new Date(Date.now() - minutes * 60_000) })
        .getCount();
    } catch {
      return 0;
    }
  }

  // ── tracking (best effort — tracking problems never block sending) ────────

  private async track(o: SendSmsOptions, smsType: string): Promise<SmsMessage | null> {
    if (!this.messages) return null;
    try {
      return await this.messages.save(this.messages.create({
        userId: o.userId ?? null,
        recipientMasked: maskPhone(o.to),
        recipientHash: this.hash(o.to),
        smsType,
        provider: this.provider!.name,
        status: SmsDeliveryStatus.QUEUED,
      }));
    } catch (e: any) {
      this.logger.warn(`SMS tracking insert failed: ${e?.message}`);
      return null;
    }
  }

  private async finishTracking(record: SmsMessage | null, result: SmsSendResult): Promise<void> {
    if (!record || !this.messages) return;
    try {
      await this.messages.update(record.id, {
        status: result.success ? SmsDeliveryStatus.ACCEPTED : SmsDeliveryStatus.FAILED,
        providerMessageId: result.messageId ?? null,
        errorCode: result.errorCode ?? null,
      });
    } catch (e: any) {
      this.logger.warn(`SMS tracking update failed: ${e?.message}`);
    }
  }

  private hash(to: string): string {
    return createHash('sha256').update(to.trim()).digest('hex');
  }
}
