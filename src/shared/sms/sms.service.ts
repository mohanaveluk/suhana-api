import { Injectable } from '@nestjs/common';
import { CustomLoggerService } from 'src/modules/logger/custom-logger.service';

export interface SendSmsOptions {
  to: string;      // E.164 destination, e.g. +12105551234
  body: string;
  // Free-form tag for log correlation, e.g. 'MOBILE_VERIFICATION'
  smsType?: string;
}

/**
 * Outbound SMS.
 *
 * The project had no SMS provider wired up when this was written (the legacy OTC
 * flow in auth.service just console.logged the code), so this is the integration
 * seam: `dispatch()` is the single place a real provider gets plugged in.
 *
 * Until SMS_PROVIDER is configured the service runs in log-only mode — it reports
 * success so the surrounding flows are testable end to end, and writes the message
 * to the log. In log-only mode the message body (which contains the OTP) is only
 * logged outside production, so codes never reach production logs.
 *
 * To go live with Twilio: `npm i twilio`, set SMS_PROVIDER=twilio plus
 * TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_FROM_NUMBER, and fill in the
 * `twilio` branch of dispatch().
 */
@Injectable()
export class SmsService {
  private readonly provider = (process.env.SMS_PROVIDER ?? '').trim().toLowerCase();

  constructor(private readonly logger: CustomLoggerService) {}

  get isConfigured(): boolean {
    return this.provider !== '';
  }

  // Never throws — a delivery failure must not roll back the caller's work.
  // Returns whether the message was handed off to a provider successfully.
  async sendSms(options: SendSmsOptions): Promise<boolean> {
    const { to, body, smsType } = options;
    try {
      await this.dispatch(to, body);
      this.logger.log(
        `SMS dispatched [${smsType ?? 'GENERIC'}] to ${this.mask(to)} via ${this.provider || 'log-only'}`,
      );
      return true;
    } catch (error: any) {
      this.logger.error(
        `SMS send failed [${smsType ?? 'GENERIC'}] to ${this.mask(to)}: ${error?.message}`,
        error?.stack,
      );
      return false;
    }
  }

  private async dispatch(to: string, body: string): Promise<void> {
    switch (this.provider) {
      case 'twilio':
        // Integration point — replace with the Twilio SDK call:
        //   const client = require('twilio')(SID, TOKEN);
        //   await client.messages.create({ to, from: FROM, body });
        throw new Error(
          'SMS_PROVIDER=twilio is set but the Twilio client is not implemented yet',
        );

      default:
        // Log-only mode. Guarded so OTP codes never land in production logs.
        if (process.env.NODE_ENV !== 'production') {
          this.logger.log(`[SMS log-only] to=${to} body="${body}"`);
        } else {
          this.logger.warn(
            `SMS_PROVIDER is not configured — message to ${this.mask(to)} was not delivered`,
          );
        }
        return;
    }
  }

  // +12105551234 -> +1210*****34
  private mask(mobile: string): string {
    if (!mobile || mobile.length < 6) return '***';
    return `${mobile.slice(0, 5)}*****${mobile.slice(-2)}`;
  }
}
