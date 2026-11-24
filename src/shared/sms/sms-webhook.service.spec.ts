import { generateKeyPairSync, sign } from 'crypto';
import { SmsWebhookService } from './sms-webhook.service';
import { SmsDeliveryStatus } from './entity/sms-message.entity';

const logger: any = { log: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() };

// A throwaway ed25519 key pair stands in for Telnyx's signing key.
const { publicKey, privateKey } = generateKeyPairSync('ed25519');
const rawPublicB64 = Buffer.from(publicKey.export({ format: 'der', type: 'spki' })).subarray(-32).toString('base64');

function signed(payload: object, ts = Math.floor(Date.now() / 1000)) {
  const raw = JSON.stringify(payload);
  const sig = sign(null, Buffer.from(`${ts}|${raw}`), privateKey).toString('base64');
  return { raw, headers: { 'telnyx-signature-ed25519': sig, 'telnyx-timestamp': String(ts) } };
}

const event = (id: string, type: string, status?: string) => ({
  data: { id, event_type: type, payload: { id: 'msg-1', to: status ? [{ status }] : [] } },
});

function makeService(row: any) {
  const repo = {
    findOne: jest.fn().mockResolvedValue(row),
    update: jest.fn().mockImplementation(async (_id, patch) => Object.assign(row ?? {}, patch)),
  };
  return { svc: new SmsWebhookService(repo as any, logger), repo };
}

describe('SmsWebhookService', () => {
  const env = { ...process.env };
  beforeEach(() => { process.env.TELNYX_PUBLIC_KEY = rawPublicB64; });
  afterEach(() => { process.env = { ...env }; });

  it('accepts a correctly signed payload', async () => {
    const { svc } = makeService(null);
    const { raw, headers } = signed(event('evt-1', 'message.sent'));
    await expect(svc.verify(raw, headers)).resolves.toBeUndefined();
  });

  it('rejects a tampered payload', async () => {
    const { svc } = makeService(null);
    const { headers } = signed(event('evt-1', 'message.sent'));
    await expect(svc.verify(JSON.stringify(event('evt-1', 'message.finalized', 'delivered')), headers)).rejects.toThrow();
  });

  it('rejects everything when no public key is configured', async () => {
    delete process.env.TELNYX_PUBLIC_KEY;
    const { svc } = makeService(null);
    const { raw, headers } = signed(event('evt-1', 'message.sent'));
    expect(svc.canVerify).toBe(false);
    await expect(svc.verify(raw, headers)).rejects.toThrow();
  });

  it('maps message.finalized delivered → DELIVERED', async () => {
    const row = { id: 'r1', status: SmsDeliveryStatus.ACCEPTED, lastEventId: null, smsType: 'LOGIN_OTP', recipientMasked: '+1210*****34' };
    const { svc } = makeService(row);
    expect(await svc.handle(event('evt-2', 'message.finalized', 'delivered'))).toBe('updated');
    expect(row.status).toBe(SmsDeliveryStatus.DELIVERED);
  });

  it('is idempotent: the same event twice updates once', async () => {
    const row = { id: 'r1', status: SmsDeliveryStatus.ACCEPTED, lastEventId: null, smsType: 'X', recipientMasked: '' };
    const { svc, repo } = makeService(row);
    await svc.handle(event('evt-3', 'message.finalized', 'delivery_failed'));
    expect(await svc.handle(event('evt-3', 'message.finalized', 'delivery_failed'))).toBe('duplicate');
    expect(repo.update).toHaveBeenCalledTimes(1);
    expect(row.status).toBe(SmsDeliveryStatus.FAILED);
  });

  it('never moves a status backwards (late message.sent after delivery)', async () => {
    const row = { id: 'r1', status: SmsDeliveryStatus.DELIVERED, lastEventId: 'evt-4', smsType: 'X', recipientMasked: '' };
    const { svc } = makeService(row);
    await svc.handle(event('evt-5', 'message.sent'));
    expect(row.status).toBe(SmsDeliveryStatus.DELIVERED);
  });

  it('ignores unrelated event types and unknown message ids', async () => {
    expect(await makeService(null).svc.handle(event('evt-6', 'message.received'))).toBe('ignored');
    expect(await makeService(null).svc.handle(event('evt-7', 'message.sent'))).toBe('unknown-message');
  });
});
