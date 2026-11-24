import { SmsService } from './sms.service';
import { SmsProvider } from './sms.types';
import { readSmsConfig } from './sms.config';
import { smsProviderFactory } from './sms.module';

const logger: any = { log: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() };
const repo = () => ({
  create: jest.fn(x => x),
  save: jest.fn(async x => ({ ...x, id: 'row-1' })),
  update: jest.fn().mockResolvedValue({ affected: 1 }),
});
const provider = (result: any): SmsProvider => ({ name: 'telnyx', enabled: true, send: jest.fn().mockResolvedValue(result) });

describe('SmsService', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns SMS_DISABLED (never success) when no provider is configured', async () => {
    const svc = new SmsService(null, logger, repo() as any);
    expect(await svc.send({ to: '+12105551234', body: 'code 123456' })).toMatchObject({ success: false, errorCode: 'SMS_DISABLED' });
    expect(await svc.sendSms({ to: '+12105551234', body: 'x' })).toBe(false);
    expect(svc.canDeliver).toBe(false);
  });

  it('tracks the message without storing content or the full number', async () => {
    const r1 = repo();
    const svc = new SmsService(provider({ success: true, provider: 'telnyx', messageId: 'm1' }), logger, r1 as any);
    const r = await svc.send({ to: '+12105551234', body: 'Your code is 654321', smsType: 'LOGIN_OTP', userId: 'u1' });
    expect(r.success).toBe(true);
    const saved = JSON.stringify(r1.save.mock.calls);
    expect(saved).not.toContain('654321');
    expect(saved).not.toContain('+12105551234');
    expect(r1.update).toHaveBeenCalledWith('row-1', expect.objectContaining({ status: 'ACCEPTED', providerMessageId: 'm1' }));
  });

  it('records FAILED and never logs the body or full number on failure', async () => {
    const r1 = repo();
    const svc = new SmsService(provider({ success: false, provider: 'telnyx', errorCode: 'AUTH_FAILED' }), logger, r1 as any);
    const r = await svc.send({ to: '+12105551234', body: 'Your code is 654321' });
    expect(r.success).toBe(false);
    expect(r1.update).toHaveBeenCalledWith('row-1', expect.objectContaining({ status: 'FAILED', errorCode: 'AUTH_FAILED' }));
    const logged = JSON.stringify([...logger.log.mock.calls, ...logger.warn.mock.calls]);
    expect(logged).not.toContain('654321');
    expect(logged).not.toContain('+12105551234');
  });

  it('converts a throwing provider into a failed result', async () => {
    const p: SmsProvider = { name: 'telnyx', enabled: true, send: jest.fn().mockRejectedValue(new Error('boom')) };
    const svc = new SmsService(p, logger, repo() as any);
    expect(await svc.send({ to: '+12105551234', body: 'x' })).toMatchObject({ success: false, errorCode: 'UNKNOWN' });
  });

  it('still sends when tracking storage fails', async () => {
    const broken = { create: jest.fn(x => x), save: jest.fn().mockRejectedValue(new Error('db down')), update: jest.fn() };
    const svc = new SmsService(provider({ success: true, provider: 'telnyx' }), logger, broken as any);
    expect((await svc.send({ to: '+12105551234', body: 'x' })).success).toBe(true);
  });
});

describe('SMS configuration / provider selection', () => {
  const saved = { ...process.env };
  afterEach(() => { process.env = { ...saved }; });

  it('defaults to disabled and log-only outside production', () => {
    const c = readSmsConfig({ NODE_ENV: 'development' } as any);
    expect(c.telnyxEnabled).toBe(false);
    expect(c.logOnly).toBe(true);
  });

  it('never enables log-only in production', () => {
    expect(readSmsConfig({ NODE_ENV: 'production', SMS_LOG_ONLY: 'true' } as any).logOnly).toBe(false);
  });

  it('does not crash, and disables SMS, when TELNYX_ENABLED=true but the key is missing', () => {
    process.env.TELNYX_ENABLED = 'true';
    process.env.TELNYX_API_KEY = '';
    process.env.TELNYX_FROM_NUMBER = '+15550000000';
    expect(smsProviderFactory(logger)).toBeNull();
  });

  it('production with Telnyx disabled has no provider at all (no fake success)', () => {
    process.env.NODE_ENV = 'production';
    process.env.TELNYX_ENABLED = 'false';
    expect(smsProviderFactory(logger)).toBeNull();
  });
});
