import { AppSettingsService, APP_SETTINGS_CACHE_MS } from './app-settings.service';
import { APP_SETTING } from './app-settings.keys';
import { SmsService } from '../sms/sms.service';
import { SmsProvider } from '../sms/sms.types';
import { AdminSmsSettingsController } from '../sms/admin-sms-settings.controller';
import { AuditEventType } from 'src/modules/audit/enums/audit-event-type.enum';

const logger: any = { log: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() };
const KEY = APP_SETTING.SMS_SENDING_ENABLED;

/** In-memory app_settings repo. */
function settingsRepo(initial?: string) {
  const rows = new Map<string, any>(initial === undefined ? [] : [[KEY, { key: KEY, value: initial, updatedBy: null, updatedAt: new Date() }]]);
  return {
    rows,
    findOne: jest.fn(async ({ where: { key } }) => rows.get(key) ?? null),
    create: jest.fn(x => x),
    save: jest.fn(async x => { rows.set(x.key, { ...x, updatedAt: new Date() }); return x; }),
  };
}

describe('AppSettingsService', () => {
  it('defaults sms_sending_enabled to true when no row exists', async () => {
    const svc = new AppSettingsService(settingsRepo() as any, logger);
    expect(await svc.getBoolean(KEY)).toBe(true);
  });

  it('caches reads for APP_SETTINGS_CACHE_MS, then re-reads', async () => {
    let t = 1_000_000;
    const repo = settingsRepo('true');
    const svc = new AppSettingsService(repo as any, logger, () => t);
    await svc.getBoolean(KEY);
    repo.rows.get(KEY).value = 'false'; // changed by another instance
    expect(await svc.getBoolean(KEY)).toBe(true); // still cached
    t += APP_SETTINGS_CACHE_MS + 1;
    expect(await svc.getBoolean(KEY)).toBe(false);
    expect(repo.findOne).toHaveBeenCalledTimes(2);
  });

  it('set() applies immediately on this instance', async () => {
    const svc = new AppSettingsService(settingsRepo('true') as any, logger);
    await svc.getBoolean(KEY);
    expect(await svc.set(KEY, 'false', 'admin-1')).toBe('true');
    expect(await svc.getBoolean(KEY)).toBe(false);
  });

  it('keeps the last known value if the DB is unreachable', async () => {
    let t = 0;
    const repo = settingsRepo('false');
    const svc = new AppSettingsService(repo as any, logger, () => t);
    await svc.getBoolean(KEY);
    repo.findOne.mockRejectedValue(new Error('db down'));
    t += APP_SETTINGS_CACHE_MS + 1;
    expect(await svc.getBoolean(KEY)).toBe(false);
  });
});

describe('SmsService with the site-wide switch', () => {
  const provider = (): SmsProvider => ({ name: 'telnyx', enabled: true, send: jest.fn().mockResolvedValue({ success: true, provider: 'telnyx' }) });

  it('OFF → nothing is sent, SMS_DISABLED is returned', async () => {
    const p = provider();
    const svc = new SmsService(p, logger, undefined, new AppSettingsService(settingsRepo('false') as any, logger));
    const r = await svc.send({ to: '+12105551234', body: 'code 123456' });
    expect(r).toMatchObject({ success: false, errorCode: 'SMS_DISABLED' });
    expect(p.send).not.toHaveBeenCalled();
    expect(await svc.isAvailable()).toBe(false);
    expect(await svc.canDeliverNow()).toBe(false);
  });

  it('ON → the message goes out', async () => {
    const p = provider();
    const svc = new SmsService(p, logger, undefined, new AppSettingsService(settingsRepo('true') as any, logger));
    expect((await svc.send({ to: '+12105551234', body: 'x' })).success).toBe(true);
    expect(p.send).toHaveBeenCalledTimes(1);
  });

  it('ON but no provider configured → still nothing sent', async () => {
    const svc = new SmsService(null, logger, undefined, new AppSettingsService(settingsRepo('true') as any, logger));
    expect((await svc.send({ to: '+12105551234', body: 'x' })).errorCode).toBe('SMS_DISABLED');
  });
});

describe('AdminSmsSettingsController', () => {
  const req = { user: { id: 'admin-1' }, ip: '127.0.0.1', headers: { 'user-agent': 'jest' } };

  function setup(initial: string, configured = true) {
    const settings = new AppSettingsService(settingsRepo(initial) as any, logger);
    const sms = new SmsService(configured ? { name: 'telnyx', enabled: true, send: jest.fn() } : null, logger, undefined, settings);
    const audit = { emit: jest.fn() };
    return { ctl: new AdminSmsSettingsController(settings, sms, audit as any), audit, settings };
  }

  it('turns SMS off, audits who did it, and reports the effective state', async () => {
    const { ctl, audit, settings } = setup('true');
    const r = await ctl.update({ enabled: false }, req);
    expect(r).toMatchObject({ sendingEnabled: false, providerConfigured: true, provider: 'telnyx', effective: false, updatedBy: 'admin-1' });
    expect(await settings.getBoolean(KEY)).toBe(false);
    expect(audit.emit).toHaveBeenCalledWith(expect.objectContaining({
      eventType: AuditEventType.SYSTEM_SETTING_CHANGED,
      userId: 'admin-1',
      oldValue: { smsSendingEnabled: true },
      newValue: { smsSendingEnabled: false },
    }));
  });

  it('does not audit a no-op change', async () => {
    const { ctl, audit } = setup('true');
    await ctl.update({ enabled: true }, req);
    expect(audit.emit).not.toHaveBeenCalled();
  });

  it('switch ON without Telnyx configured is not effective', async () => {
    const { ctl } = setup('true', false);
    expect(await ctl.getStatus()).toMatchObject({ sendingEnabled: true, providerConfigured: false, effective: false });
  });
});
