import Telnyx from 'telnyx';
import { CustomLoggerService } from 'src/modules/logger/custom-logger.service';
import { SmsConfig } from '../sms.config';
import { E164, SmsErrorCode, SmsProvider, SmsSendResult, maskPhone } from '../sms.types';

/** Bounded retry policy for failures where Telnyx certainly did NOT accept the message. */
export const TELNYX_RETRY = {
  maxRetries: 2,
  baseDelayMs: 500,
  maxDelayMs: 4_000,
  /** Longest Retry-After we are willing to wait inside a user request. */
  maxRetryAfterMs: 5_000,
  timeoutMs: 10_000,
};

type TelnyxClient = Pick<Telnyx, 'messages'>;

/**
 * Telnyx Messaging (official `telnyx` SDK). One client per process, created at start-up.
 *
 * Retries: the SDK's own retries are disabled (`maxRetries: 0`) because they also retry
 * timeouts — a timed-out POST may already have been accepted, and retrying it would text the
 * user a second code. We retry only 429 / 502 / 503 (request not processed), with exponential
 * backoff + jitter, honouring Retry-After. Timeouts and other errors are returned at once.
 */
export class TelnyxSmsProvider implements SmsProvider {
  readonly name = 'telnyx';
  private readonly client: TelnyxClient | null;

  constructor(
    private readonly config: SmsConfig,
    private readonly logger: CustomLoggerService,
    client?: TelnyxClient,
    private readonly sleep: (ms: number) => Promise<void> = ms => new Promise(r => setTimeout(r, ms)),
  ) {
    this.client = client ?? (this.isConfigured(config)
      ? new Telnyx({ apiKey: config.apiKey, maxRetries: 0, timeout: TELNYX_RETRY.timeoutMs })
      : null);
  }

  get enabled(): boolean {
    return !!this.client;
  }

  private isConfigured(c: SmsConfig): boolean {
    return c.telnyxEnabled && !!c.apiKey && E164.test(c.fromNumber);
  }

  async send(to: string, text: string): Promise<SmsSendResult> {
    if (!this.client) return { success: false, provider: this.name, errorCode: 'SMS_DISABLED', errorMessage: 'Telnyx is not configured' };
    if (!E164.test(to)) return { success: false, provider: this.name, errorCode: 'INVALID_NUMBER', errorMessage: 'Destination is not E.164' };

    for (let attempt = 0; ; attempt++) {
      try {
        const res = await this.client.messages.send({
          from: this.config.fromNumber,
          to,
          text,
          ...(this.config.messagingProfileId ? { messaging_profile_id: this.config.messagingProfileId } : {}),
        });
        return { success: true, provider: this.name, messageId: res?.data?.id };
      } catch (err) {
        const failure = this.classify(err);
        const delay = failure.retryable && attempt < TELNYX_RETRY.maxRetries ? this.retryDelay(err, attempt) : null;
        this.logger.warn(
          `Telnyx send to ${maskPhone(to)} failed (${failure.code}${failure.status ? ` / HTTP ${failure.status}` : ''})` +
          (delay !== null ? ` — retry ${attempt + 1} in ${delay}ms` : ''),
        );
        if (delay === null) {
          return { success: false, provider: this.name, errorCode: failure.code, errorMessage: failure.message };
        }
        await this.sleep(delay);
      }
    }
  }

  /** Maps SDK errors to our codes. Never includes credentials or the message text. */
  classify(err: unknown): { code: SmsErrorCode; status?: number; retryable: boolean; message: string } {
    const e = err as { status?: number; name?: string; constructor?: { name?: string }; message?: string; error?: unknown };
    const kind = e?.constructor?.name ?? e?.name ?? '';
    const status = typeof e?.status === 'number' ? e.status : undefined;
    const detail = this.providerDetail(e?.error) ?? `HTTP ${status ?? 'n/a'}`;

    if (kind === 'APIConnectionTimeoutError') return { code: 'TIMEOUT', retryable: false, message: 'Provider timed out' };
    if (kind === 'APIConnectionError' || (status === undefined && kind !== 'APIUserAbortError')) {
      return { code: 'NETWORK_ERROR', retryable: false, message: 'Provider unreachable' };
    }
    switch (status) {
      case 400: return { code: 'INVALID_REQUEST', status, retryable: false, message: detail };
      case 401: return { code: 'AUTH_FAILED', status, retryable: false, message: 'Telnyx rejected the API key' };
      case 403: return { code: 'FORBIDDEN', status, retryable: false, message: detail };
      case 422: return { code: this.looksLikeBadNumber(e?.error) ? 'INVALID_NUMBER' : 'INVALID_REQUEST', status, retryable: false, message: detail };
      case 429: return { code: 'RATE_LIMITED', status, retryable: true, message: 'Rate limited' };
      case 502:
      case 503: return { code: 'PROVIDER_ERROR', status, retryable: true, message: detail };
      default:
        return status && status >= 500
          ? { code: 'PROVIDER_ERROR', status, retryable: false, message: detail } // 500/504: may have been processed — don't resend
          : { code: 'UNKNOWN', status, retryable: false, message: detail };
    }
  }

  private retryDelay(err: unknown, attempt: number): number | null {
    const headers = (err as { headers?: Headers })?.headers;
    const retryAfter = headers?.get?.('retry-after');
    if (retryAfter) {
      const secs = Number(retryAfter);
      const ms = Number.isFinite(secs) ? secs * 1000 : Date.parse(retryAfter) - Date.now();
      if (Number.isFinite(ms) && ms >= 0) return ms <= TELNYX_RETRY.maxRetryAfterMs ? Math.ceil(ms) : null;
    }
    const exp = Math.min(TELNYX_RETRY.maxDelayMs, TELNYX_RETRY.baseDelayMs * 2 ** attempt);
    return Math.round(exp / 2 + Math.random() * (exp / 2)); // equal jitter
  }

  /** First error title/code from a Telnyx error body, without echoing the request. */
  private providerDetail(body: unknown): string | null {
    const first = (body as { errors?: { code?: string; title?: string }[] })?.errors?.[0];
    return first ? [first.code, first.title].filter(Boolean).join(' ') : null;
  }

  private looksLikeBadNumber(body: unknown): boolean {
    const errs = (body as { errors?: { title?: string; detail?: string; source?: { pointer?: string } }[] })?.errors ?? [];
    return errs.some(x => /\/to\b/.test(x.source?.pointer ?? '') || /phone number|destination|\bto\b/i.test(`${x.title} ${x.detail}`));
  }
}
