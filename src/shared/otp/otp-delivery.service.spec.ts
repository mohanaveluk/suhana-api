import { OtpDeliveryService } from './otp-delivery.service';
import { generateOtp, otpTtlMinutes, SMS_PER_NUMBER_MAX } from './otp-policy';
import { otpSmsTemplates } from './otp-sms.templates';

const logger: any = { log: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() };

function setup({ canDeliver = true, sendResult = { success: true }, recent = 0 } = {}) {
  const sms: any = {
    canDeliverNow: jest.fn().mockResolvedValue(canDeliver),
    send: jest.fn().mockResolvedValue(sendResult),
    countRecentToNumber: jest.fn().mockResolvedValue(recent),
  };
  const sendEmail = jest.fn().mockResolvedValue(true);
  return { svc: new OtpDeliveryService(sms, logger), sms, sendEmail };
}

const verified = { id: 'u1', mobile: '+12105551234', isMobileVerified: 1 };
const req = (user: any, sendEmail: any, purpose: 'LOGIN' | 'PASSWORD_RESET' = 'LOGIN') =>
  ({ purpose, user, code: '123456', ttlMinutes: 15, sendEmail });

describe('OtpDeliveryService', () => {
  beforeEach(() => jest.clearAllMocks());

  it('login OTP → SMS for a verified mobile', async () => {
    const { svc, sms, sendEmail } = setup();
    expect(await svc.deliverAccountOtp(req(verified, sendEmail))).toBe('sms');
    expect(sms.send).toHaveBeenCalledWith(expect.objectContaining({ to: '+12105551234', smsType: 'LOGIN_OTP', body: otpSmsTemplates.login('123456', 15) }));
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it('password reset OTP → SMS for a verified mobile, with the reset template', async () => {
    const { svc, sms, sendEmail } = setup();
    expect(await svc.deliverAccountOtp(req(verified, sendEmail, 'PASSWORD_RESET'))).toBe('sms');
    expect(sms.send.mock.calls[0][0].body).toContain('password reset code is 123456');
  });

  it.each([
    ['unverified mobile', { ...verified, isMobileVerified: 0 }],
    ['no mobile', { ...verified, mobile: null }],
    ['invalid mobile', { ...verified, mobile: '2105551234' }],
  ])('%s → email (no SMS attempt)', async (_l, user) => {
    const { svc, sms, sendEmail } = setup();
    expect(await svc.deliverAccountOtp(req(user, sendEmail))).toBe('email');
    expect(sms.send).not.toHaveBeenCalled();
    expect(sendEmail).toHaveBeenCalledTimes(1);
  });

  it('SMS disabled → email', async () => {
    const { svc, sms, sendEmail } = setup({ canDeliver: false });
    expect(await svc.deliverAccountOtp(req(verified, sendEmail))).toBe('email');
    expect(sms.send).not.toHaveBeenCalled();
  });

  it('SMS failure → falls back to email', async () => {
    const { svc, sendEmail } = setup({ sendResult: { success: false, errorCode: 'PROVIDER_ERROR' } as any });
    expect(await svc.deliverAccountOtp(req(verified, sendEmail))).toBe('email');
    expect(sendEmail).toHaveBeenCalledTimes(1);
  });

  it('per-number SMS limit reached → email', async () => {
    const { svc, sms, sendEmail } = setup({ recent: SMS_PER_NUMBER_MAX });
    expect(await svc.deliverAccountOtp(req(verified, sendEmail))).toBe('email');
    expect(sms.send).not.toHaveBeenCalled();
  });
});

describe('OTP policy', () => {
  it('generates 6-digit numeric codes', () => {
    for (let i = 0; i < 200; i++) expect(generateOtp()).toMatch(/^\d{6}$/);
  });

  it('uses defaults and accepts valid env overrides only', () => {
    expect(otpTtlMinutes('LOGIN', {} as any)).toBe(15);
    expect(otpTtlMinutes('PASSWORD_RESET', {} as any)).toBe(5);
    expect(otpTtlMinutes('MOBILE_VERIFICATION', {} as any)).toBe(10);
    expect(otpTtlMinutes('LOGIN', { OTP_TTL_MINUTES_LOGIN: '7' } as any)).toBe(7);
    expect(otpTtlMinutes('LOGIN', { OTP_TTL_MINUTES_LOGIN: '0' } as any)).toBe(15);
    expect(otpTtlMinutes('LOGIN', { OTP_TTL_MINUTES_LOGIN: 'abc' } as any)).toBe(15);
  });
});
