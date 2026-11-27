// nanoid is ESM-only; AuthService imports it for unrelated features.
jest.mock('nanoid', () => ({ nanoid: () => 'id', customAlphabet: () => () => 'id' }));

import * as bcrypt from 'bcrypt';
import { BadRequestException, GoneException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { OtpDeliveryService } from 'src/shared/otp/otp-delivery.service';
import { OTP_MAX_ATTEMPTS, OTP_RESEND_MAX } from 'src/shared/otp/otp-policy';

/**
 * Login-OTC and forgot-password flows with SMS delivery. Telnyx is never touched: SmsService is
 * a mock behind the real OtpDeliveryService, so the SMS-vs-email decision is exercised for real.
 */
const logger: any = { log: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() };

const otpRepo = () => ({
  count: jest.fn().mockResolvedValue(0),
  update: jest.fn().mockResolvedValue({ affected: 1 }),
  create: jest.fn(x => x),
  save: jest.fn(async x => ({ id: 'otp-1', ...x })),
  findOne: jest.fn(),
});

function setup(user: any, { canDeliver = true, smsResult = { success: true, provider: 'telnyx' } } = {}) {
  const userRepo = { findOne: jest.fn().mockResolvedValue(user), save: jest.fn(async x => x) };
  const loginOtcRepo = otpRepo();
  const tokenRepo = otpRepo();
  const emailService = { sendEmail: jest.fn().mockResolvedValue(true) };
  const sms: any = { canDeliverNow: jest.fn().mockResolvedValue(canDeliver), send: jest.fn().mockResolvedValue(smsResult), countRecentToNumber: jest.fn().mockResolvedValue(0) };
  const tokenService = { generateTokens: jest.fn().mockResolvedValue({ accessToken: 'jwt' }) };
  const history = { recordLogin: jest.fn() };
  const otpDelivery = new OtpDeliveryService(sms, logger);
  const n: any = null;
  const svc = new AuthService(
    userRepo as any, n, n, n, n, tokenRepo as any, loginOtcRepo as any,
    n, n, tokenService as any, n, n, emailService as any, n, history as any, logger, otpDelivery, n,
  );
  return { svc, userRepo, loginOtcRepo, tokenRepo, emailService, sms };
}

const verifiedUser = {
  id: 'u1', email: 'member@example.com', first_name: 'Asha', is_active: 1, is_email_verified: 1,
  mobile: '+12105551234', isMobileVerified: 1,
};
const emailOnlyUser = { ...verifiedUser, isMobileVerified: 0 };
const req: any = { ip: '127.0.0.1', headers: { 'user-agent': 'jest' } };

describe('AuthService – login OTC', () => {
  beforeEach(() => jest.clearAllMocks());

  it('verified mobile → code by SMS, not email; generic response', async () => {
    const { svc, sms, emailService, loginOtcRepo } = setup(verifiedUser);
    const r = await svc.sendLoginOtc('member@example.com', 'aurora.test');
    expect(r.message).toMatch(/If this account is registered/);
    expect(sms.send).toHaveBeenCalledWith(expect.objectContaining({ to: '+12105551234', smsType: 'LOGIN_OTP' }));
    expect(emailService.sendEmail).not.toHaveBeenCalled();
    expect(loginOtcRepo.update).toHaveBeenCalledWith('otp-1', { channel: 'sms' });
    // stored hashed, never plaintext
    const saved = loginOtcRepo.save.mock.calls[0][0];
    expect(saved.codeHash.startsWith('$2')).toBe(true);
  });

  it('unverified mobile → email (existing behaviour)', async () => {
    const { svc, sms, emailService } = setup(emailOnlyUser);
    await svc.sendLoginOtc('member@example.com', 'aurora.test');
    expect(sms.send).not.toHaveBeenCalled();
    expect(emailService.sendEmail).toHaveBeenCalledWith(expect.objectContaining({ subject: 'Aurora - Your one-time login code' }));
  });

  it('SMS failure → falls back to email', async () => {
    const { svc, emailService } = setup(verifiedUser, { smsResult: { success: false, errorCode: 'RATE_LIMITED' } as any });
    await svc.sendLoginOtc('member@example.com', 'aurora.test');
    expect(emailService.sendEmail).toHaveBeenCalledTimes(1);
  });

  it('SMS disabled → email', async () => {
    const { svc, sms, emailService } = setup(verifiedUser, { canDeliver: false });
    await svc.sendLoginOtc('member@example.com', 'aurora.test');
    expect(sms.send).not.toHaveBeenCalled();
    expect(emailService.sendEmail).toHaveBeenCalledTimes(1);
  });

  it('unknown email → same generic response, nothing sent (no enumeration)', async () => {
    const { svc, sms, emailService } = setup(null);
    const r = await svc.sendLoginOtc('nobody@example.com', 'aurora.test');
    const known = await setup(verifiedUser).svc.sendLoginOtc('member@example.com', 'aurora.test');
    expect(r).toEqual(known);
    expect(sms.send).not.toHaveBeenCalled();
    expect(emailService.sendEmail).not.toHaveBeenCalled();
  });

  it('resend limit → same generic response, nothing sent', async () => {
    const { svc, sms, emailService, loginOtcRepo } = setup(verifiedUser);
    loginOtcRepo.count.mockResolvedValue(OTP_RESEND_MAX);
    const r = await svc.sendLoginOtc('member@example.com', 'aurora.test');
    expect(r.message).toMatch(/If this account is registered/);
    expect(sms.send).not.toHaveBeenCalled();
    expect(emailService.sendEmail).not.toHaveBeenCalled();
    expect(loginOtcRepo.save).not.toHaveBeenCalled();
  });

  it('invalidates the previous code instead of deleting it (so resends can be counted)', async () => {
    const { svc, loginOtcRepo } = setup(verifiedUser);
    await svc.sendLoginOtc('member@example.com', 'aurora.test');
    expect(loginOtcRepo.update).toHaveBeenCalledWith({ email: 'member@example.com', used: false }, { expiresAt: expect.any(Date) });
  });

  describe('validateLoginOtc', () => {
    const record = async (o: any = {}) => ({
      id: 'otp-1', email: 'member@example.com', codeHash: await bcrypt.hash('482731', 4),
      expiresAt: new Date(Date.now() + 60_000), used: false, attemptCount: 0, ...o,
    });

    it('accepts the right code once (one-time use)', async () => {
      const { svc, loginOtcRepo, userRepo } = setup(verifiedUser);
      loginOtcRepo.findOne.mockResolvedValue(await record());
      userRepo.findOne.mockResolvedValue({ ...verifiedUser, role: { name: 'member' } });
      await expect(svc.validateLoginOtc({ email: 'member@example.com', code: '482731' } as any, req)).resolves.toEqual({ accessToken: 'jwt' });
      expect(loginOtcRepo.update).toHaveBeenCalledWith({ id: 'otp-1', used: false }, { used: true });

      loginOtcRepo.update.mockResolvedValueOnce({ affected: 0 }); // concurrent replay lost the race
      await expect(svc.validateLoginOtc({ email: 'member@example.com', code: '482731' } as any, req)).rejects.toThrow(BadRequestException);
    });

    it('counts wrong guesses and burns the code at the limit', async () => {
      const { svc, loginOtcRepo } = setup(verifiedUser);
      loginOtcRepo.findOne.mockResolvedValue(await record({ attemptCount: OTP_MAX_ATTEMPTS - 1 }));
      await expect(svc.validateLoginOtc({ email: 'member@example.com', code: '000000' } as any, req)).rejects.toThrow(/Too many incorrect attempts/);
      expect(loginOtcRepo.update).toHaveBeenCalledWith('otp-1', { attemptCount: OTP_MAX_ATTEMPTS, expiresAt: expect.any(Date) });
    });

    it('rejects even the right code once locked', async () => {
      const { svc, loginOtcRepo } = setup(verifiedUser);
      loginOtcRepo.findOne.mockResolvedValue(await record({ attemptCount: OTP_MAX_ATTEMPTS }));
      await expect(svc.validateLoginOtc({ email: 'member@example.com', code: '482731' } as any, req)).rejects.toThrow(/Too many incorrect attempts/);
    });

    it('410s an expired code', async () => {
      const { svc, loginOtcRepo } = setup(verifiedUser);
      loginOtcRepo.findOne.mockResolvedValue(await record({ expiresAt: new Date(Date.now() - 1000) }));
      await expect(svc.validateLoginOtc({ email: 'member@example.com', code: '482731' } as any, req)).rejects.toThrow(GoneException);
    });
  });
});

describe('AuthService – forgot password', () => {
  beforeEach(() => jest.clearAllMocks());

  it('verified mobile → reset code by SMS', async () => {
    const { svc, sms, emailService } = setup(verifiedUser);
    await svc.forgotPassword('member@example.com');
    expect(sms.send).toHaveBeenCalledWith(expect.objectContaining({ smsType: 'PASSWORD_RESET_OTP' }));
    expect(sms.send.mock.calls[0][0].body).toMatch(/password reset code is \d{6}\. It expires in 5 minutes/);
    expect(emailService.sendEmail).not.toHaveBeenCalled();
  });

  it('unverified mobile → email (existing behaviour)', async () => {
    const { svc, sms, emailService } = setup(emailOnlyUser);
    await svc.forgotPassword('member@example.com');
    expect(sms.send).not.toHaveBeenCalled();
    expect(emailService.sendEmail).toHaveBeenCalledWith(expect.objectContaining({ subject: 'Aurora - Your password reset code' }));
  });

  it('SMS failure → falls back to email', async () => {
    const { svc, emailService } = setup(verifiedUser, { smsResult: { success: false, errorCode: 'TIMEOUT' } as any });
    await svc.forgotPassword('member@example.com');
    expect(emailService.sendEmail).toHaveBeenCalledTimes(1);
  });

  it('unknown email → silent, nothing sent', async () => {
    const { svc, sms, emailService } = setup(null);
    await expect(svc.forgotPassword('nobody@example.com')).resolves.toBeUndefined();
    expect(sms.send).not.toHaveBeenCalled();
    expect(emailService.sendEmail).not.toHaveBeenCalled();
  });

  it('wrong reset codes are counted and lock out', async () => {
    const { svc, tokenRepo } = setup(verifiedUser);
    tokenRepo.findOne.mockResolvedValue({
      id: 'otp-1', email: 'member@example.com', otpHash: await bcrypt.hash('482731', 4),
      expiresAt: new Date(Date.now() + 60_000), used: false, attemptCount: OTP_MAX_ATTEMPTS - 1,
    });
    await expect(svc.verifyResetCode('member@example.com', '111111')).rejects.toThrow(/Too many incorrect attempts/);
  });
});

describe('AuthService – retired legacy mobile login', () => {
  it.each(['loginWithMobile', 'validateOTC', 'sendMobileOTC'])('%s answers 410 Gone', async (m) => {
    const { svc } = setup(verifiedUser);
    await expect((svc as any)[m]({ mobile: '+12105551234', code: '123456' })).rejects.toThrow(GoneException);
  });
});
