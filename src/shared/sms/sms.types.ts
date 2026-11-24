/** Standardised result of one SMS send attempt — what every caller gets back from SmsService. */
export interface SmsSendResult {
  success: boolean;
  /** Provider message id (Telnyx `data.id`) when the provider accepted the message. */
  messageId?: string;
  provider?: string;
  errorCode?: SmsErrorCode;
  /** Safe, internal description (never shown to end users, never contains credentials). */
  errorMessage?: string;
}

export type SmsErrorCode =
  | 'SMS_DISABLED'        // no provider configured / TELNYX_ENABLED=false
  | 'INVALID_NUMBER'      // not an E.164 number, or the provider rejected the destination
  | 'INVALID_REQUEST'     // 400 / 422 — bad payload or messaging configuration
  | 'AUTH_FAILED'         // 401 — API key wrong or revoked
  | 'FORBIDDEN'           // 403 — number / messaging profile not allowed (e.g. 10DLC not approved)
  | 'RATE_LIMITED'        // 429 after bounded retries
  | 'PROVIDER_ERROR'      // 5xx after bounded retries
  | 'TIMEOUT'             // no response in time — NOT retried (the message may have been accepted)
  | 'NETWORK_ERROR'       // could not reach the provider
  | 'UNKNOWN';

export interface SendSmsOptions {
  /** E.164 destination, e.g. +12105551234 */
  to: string;
  body: string;
  /** Tag for logs and delivery tracking, e.g. 'LOGIN_OTP'. Never put the message content here. */
  smsType?: string;
  /** Owner of the destination number, for delivery tracking. */
  userId?: string;
}

/**
 * Contract every SMS provider implements. Authentication / OTP code only ever talks to
 * SmsService, so replacing Telnyx means writing another provider and changing the binding
 * in SmsModule — nothing else.
 */
export interface SmsProvider {
  readonly name: string;
  /** Configured and allowed to send. */
  readonly enabled: boolean;
  send(to: string, text: string): Promise<SmsSendResult>;
}

export const SMS_PROVIDER = Symbol('SMS_PROVIDER');

/** E.164: '+', country code 1-9, 8–15 digits in total. */
export const E164 = /^\+[1-9]\d{7,14}$/;

/** +12105551234 → +1210*****34 (keeps full numbers out of logs). */
export function maskPhone(mobile: string | null | undefined): string {
  if (!mobile || mobile.length < 6) return '***';
  return `${mobile.slice(0, 5)}*****${mobile.slice(-2)}`;
}
