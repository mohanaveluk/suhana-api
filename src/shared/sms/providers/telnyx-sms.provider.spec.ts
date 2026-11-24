import {
  APIConnectionError, APIConnectionTimeoutError, AuthenticationError, BadRequestError,
  InternalServerError, PermissionDeniedError, RateLimitError, UnprocessableEntityError,
} from 'telnyx';
import { TelnyxSmsProvider, TELNYX_RETRY } from './telnyx-sms.provider';
import { SmsConfig } from '../sms.config';

// No network: every test injects a mocked Telnyx client. No real SMS is ever sent.
const config: SmsConfig = {
  telnyxEnabled: true, apiKey: 'test-key-not-real', fromNumber: '+15550000000',
  messagingProfileId: 'mp-123', publicKey: '', logOnly: false, isProduction: false,
};
const TO = '+12105551234';
const logger: any = { log: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() };
const body = (code: string, title: string, pointer?: string) =>
  ({ errors: [{ code, title, ...(pointer ? { source: { pointer } } : {}) }] });

function setup(...outcomes: Array<unknown>) {
  const send = jest.fn();
  for (const o of outcomes) {
    if (o instanceof Error) send.mockRejectedValueOnce(o);
    else send.mockResolvedValueOnce(o);
  }
  const sleep = jest.fn().mockResolvedValue(undefined);
  const provider = new TelnyxSmsProvider(config, logger, { messages: { send } } as any, sleep);
  return { provider, send, sleep };
}

describe('TelnyxSmsProvider', () => {
  beforeEach(() => jest.clearAllMocks());

  it('sends and returns the Telnyx message id', async () => {
    const { provider, send } = setup({ data: { id: 'msg-1' } });
    const r = await provider.send(TO, 'Aurora Matrimony: Your login code is 123456.');
    expect(r).toEqual({ success: true, provider: 'telnyx', messageId: 'msg-1' });
    expect(send).toHaveBeenCalledWith({ from: '+15550000000', to: TO, text: expect.any(String), messaging_profile_id: 'mp-123' });
  });

  it('rejects a non-E.164 destination without calling Telnyx', async () => {
    const { provider, send } = setup();
    expect((await provider.send('2105551234', 'x')).errorCode).toBe('INVALID_NUMBER');
    expect(send).not.toHaveBeenCalled();
  });

  it('is disabled (no client) when the API key is missing', async () => {
    const p = new TelnyxSmsProvider({ ...config, apiKey: '' }, logger);
    expect(p.enabled).toBe(false);
    expect((await p.send(TO, 'x')).errorCode).toBe('SMS_DISABLED');
  });

  it.each([
    ['400', () => new BadRequestError(400, body('10015', 'Bad request'), 'bad', new Headers()), 'INVALID_REQUEST'],
    ['401', () => new AuthenticationError(401, body('10009', 'Authentication failed'), 'auth', new Headers()), 'AUTH_FAILED'],
    ['403', () => new PermissionDeniedError(403, body('40013', 'Not 10DLC registered'), 'forbidden', new Headers()), 'FORBIDDEN'],
    ['422 bad number', () => new UnprocessableEntityError(422, body('40310', 'Invalid phone number', '/to'), 'x', new Headers()), 'INVALID_NUMBER'],
    ['422 other', () => new UnprocessableEntityError(422, body('40305', 'Invalid from address', '/from'), 'x', new Headers()), 'INVALID_REQUEST'],
    ['500', () => new InternalServerError(500, body('90001', 'Internal'), 'x', new Headers()), 'PROVIDER_ERROR'],
  ])('maps HTTP %s to its error code without retrying', async (_label, make, code) => {
    const { provider, send, sleep } = setup(make());
    const r = await provider.send(TO, 'x');
    expect(r).toMatchObject({ success: false, provider: 'telnyx', errorCode: code });
    expect(send).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it('never leaks the API key in the result', async () => {
    const { provider } = setup(new AuthenticationError(401, body('10009', 'Authentication failed'), 'auth', new Headers()));
    const r = await provider.send(TO, 'x');
    expect(JSON.stringify(r)).not.toContain(config.apiKey);
  });

  it('retries 429 honouring Retry-After, then succeeds', async () => {
    const { provider, send, sleep } = setup(
      new RateLimitError(429, body('10011', 'Too many requests'), 'rl', new Headers({ 'retry-after': '2' })),
      { data: { id: 'msg-2' } },
    );
    const r = await provider.send(TO, 'x');
    expect(r).toMatchObject({ success: true, messageId: 'msg-2' });
    expect(send).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(2000);
  });

  it('gives up after bounded retries on persistent 503, with capped backoff', async () => {
    const e = () => new InternalServerError(503, body('90002', 'Unavailable'), 'x', new Headers());
    const { provider, send, sleep } = setup(e(), e(), e(), e());
    const r = await provider.send(TO, 'x');
    expect(r).toMatchObject({ success: false, errorCode: 'PROVIDER_ERROR' });
    expect(send).toHaveBeenCalledTimes(TELNYX_RETRY.maxRetries + 1);
    expect(sleep).toHaveBeenCalledTimes(TELNYX_RETRY.maxRetries);
    for (const [ms] of sleep.mock.calls) {
      expect(ms).toBeGreaterThan(0);
      expect(ms).toBeLessThanOrEqual(TELNYX_RETRY.maxDelayMs);
    }
  });

  it('does not wait for a Retry-After longer than the cap', async () => {
    const { provider, send, sleep } = setup(
      new RateLimitError(429, body('10011', 'Too many'), 'rl', new Headers({ 'retry-after': '60' })),
    );
    expect((await provider.send(TO, 'x')).errorCode).toBe('RATE_LIMITED');
    expect(send).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it('does NOT retry a timeout (the message may already have been accepted)', async () => {
    const { provider, send } = setup(new APIConnectionTimeoutError());
    expect((await provider.send(TO, 'x')).errorCode).toBe('TIMEOUT');
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('maps a connection failure to NETWORK_ERROR', async () => {
    const { provider } = setup(new APIConnectionError({ message: 'ECONNREFUSED' }));
    expect((await provider.send(TO, 'x')).errorCode).toBe('NETWORK_ERROR');
  });
});
