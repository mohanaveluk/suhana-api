import { Injectable } from '@nestjs/common';
import { CustomLoggerService } from 'src/modules/logger/custom-logger.service';
import { SmsService } from '../sms/sms.service';
import { E164, maskPhone } from '../sms/sms.types';
import { OtpPurpose, SMS_PER_NUMBER_MAX, SMS_PER_NUMBER_WINDOW_MINUTES } from './otp-policy';
import { otpSmsTemplates } from './otp-sms.templates';

export type OtpChannel = 'sms' | 'email';

export interface OtpRecipient {
  id: string;
  mobile?: string | null;
  isMobileVerified?: number | null;
}

export interface AccountOtpRequest {
  purpose: Exclude<OtpPurpose, 'MOBILE_VERIFICATION'>;
  user: OtpRecipient;
  code: string;
  ttlMinutes: number;
  /** The existing email delivery for this flow — used when SMS is not appropriate or fails. */
  sendEmail: () => Promise<unknown>;
}

/**
 * Chooses how an account OTP (login / password reset) reaches the user:
 *   SMS   — Telnyx configured AND is_mobile_verified = 1 AND mobile is valid E.164
 *           AND the number is under its abuse limit;
 *   email — everything else, and whenever the SMS attempt fails (fallback).
 * Mobile-verification codes are SMS-only and handled by MobileVerificationService.
 */
@Injectable()
export class OtpDeliveryService {
  constructor(
    private readonly sms: SmsService,
    private readonly logger: CustomLoggerService,
  ) {}

  /** True when this account qualifies for SMS (verified, valid number) — provider/switch checked separately. */
  smsEligible(user: OtpRecipient): boolean {
    return user.isMobileVerified === 1 && !!user.mobile && E164.test(user.mobile.trim());
  }

  async deliverAccountOtp(req: AccountOtpRequest): Promise<OtpChannel> {
    // canDeliverNow: Telnyx configured AND the site-wide admin switch is on
    if (this.smsEligible(req.user) && (await this.sms.canDeliverNow())) {
      const to = req.user.mobile!.trim();
      if (await this.sms.countRecentToNumber(to, SMS_PER_NUMBER_WINDOW_MINUTES) >= SMS_PER_NUMBER_MAX) {
        this.logger.warn(`${req.purpose} OTP: SMS limit reached for ${maskPhone(to)} — using email`);
      } else {
        const result = await this.sms.send({
          to,
          body: req.purpose === 'LOGIN'
            ? otpSmsTemplates.login(req.code, req.ttlMinutes)
            : otpSmsTemplates.passwordReset(req.code, req.ttlMinutes),
          smsType: `${req.purpose}_OTP`,
          userId: req.user.id,
        });
        if (result.success) return 'sms';
        this.logger.warn(`${req.purpose} OTP: SMS failed (${result.errorCode}) for user ${req.user.id} — falling back to email`);
      }
    }
    await req.sendEmail();
    return 'email';
  }
}
