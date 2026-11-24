/**
 * SMS configuration, read once from the environment. Missing or partial configuration never
 * crashes the app — SMS simply stays disabled and email OTP delivery carries on unchanged.
 *
 *   TELNYX_ENABLED=true|false        master switch (default false)
 *   TELNYX_API_KEY=…                 secret — Google Secret Manager in production, never in code/git
 *   TELNYX_FROM_NUMBER=+1…           E.164 sending number registered in Telnyx (10DLC / toll-free)
 *   TELNYX_MESSAGING_PROFILE_ID=…    optional — messaging profile to send through
 *   TELNYX_PUBLIC_KEY=…              optional — verifies delivery-status webhooks
 *   SMS_LOG_ONLY=true|false          development only: log messages instead of sending
 *                                    (default true outside production when Telnyx is disabled;
 *                                    always off in production)
 */
export interface SmsConfig {
  telnyxEnabled: boolean;
  apiKey: string;
  fromNumber: string;
  messagingProfileId: string;
  publicKey: string;
  logOnly: boolean;
  isProduction: boolean;
}

const flag = (v: string | undefined, fallback: boolean) =>
  v === undefined || v.trim() === '' ? fallback : ['1', 'true', 'yes', 'on'].includes(v.trim().toLowerCase());

export function readSmsConfig(env: NodeJS.ProcessEnv = process.env): SmsConfig {
  const isProduction = env.NODE_ENV === 'production';
  const telnyxEnabled = flag(env.TELNYX_ENABLED, false);
  return {
    telnyxEnabled,
    apiKey: (env.TELNYX_API_KEY ?? '').trim(),
    fromNumber: (env.TELNYX_FROM_NUMBER ?? '').trim(),
    messagingProfileId: (env.TELNYX_MESSAGING_PROFILE_ID ?? '').trim(),
    publicKey: (env.TELNYX_PUBLIC_KEY ?? '').trim(),
    // Log-only is a development convenience; it can never be on in production.
    logOnly: !isProduction && !telnyxEnabled && flag(env.SMS_LOG_ONLY, true),
    isProduction,
  };
}
