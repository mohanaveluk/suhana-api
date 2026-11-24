import { Logger } from '@nestjs/common';
import { E164, SmsProvider, SmsSendResult, maskPhone } from '../sms.types';

/**
 * Development-only stand-in when Telnyx is disabled: prints the message to the console so OTP
 * flows can be exercised locally. Never constructed in production (see readSmsConfig().logOnly).
 *
 * Uses Nest's console Logger on purpose — NOT CustomLoggerService, which also persists to the
 * log_tbl database table; message text (which contains the OTP) must never reach the database.
 * Reports provider "log" so nobody mistakes it for a real delivery.
 */
export class LogSmsProvider implements SmsProvider {
  readonly name = 'log';
  readonly enabled = true;

  constructor(private readonly console: Pick<Logger, 'log'> = new Logger('SmsLogOnly')) {}

  async send(to: string, text: string): Promise<SmsSendResult> {
    if (!E164.test(to)) return { success: false, provider: this.name, errorCode: 'INVALID_NUMBER', errorMessage: 'Destination is not E.164' };
    this.console.log(`[SMS log-only — not sent] to=${maskPhone(to)} body="${text}"`);
    return { success: true, provider: this.name, messageId: `log-${Date.now()}` };
  }
}
