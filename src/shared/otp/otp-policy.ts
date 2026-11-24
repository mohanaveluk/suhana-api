import { randomInt } from 'crypto';

export type OtpPurpose = 'MOBILE_VERIFICATION' | 'LOGIN' | 'PASSWORD_RESET';

/** Defaults match the behaviour that existed before SMS (10 / 15 / 5 minutes). */
const DEFAULT_TTL_MINUTES: Record<OtpPurpose, number> = {
  MOBILE_VERIFICATION: 10,
  LOGIN: 15,
  PASSWORD_RESET: 5,
};

const TTL_ENV: Record<OtpPurpose, string> = {
  MOBILE_VERIFICATION: 'OTP_TTL_MINUTES_MOBILE_VERIFICATION',
  LOGIN: 'OTP_TTL_MINUTES_LOGIN',
  PASSWORD_RESET: 'OTP_TTL_MINUTES_PASSWORD_RESET',
};

export const OTP_LENGTH = 6;
/** Wrong guesses allowed per code before it is burned. */
export const OTP_MAX_ATTEMPTS = 5;
/** Codes per account (email / user) per rolling window. */
export const OTP_RESEND_MAX = 3;
export const OTP_RESEND_WINDOW_MINUTES = 15;
/** SMS to one phone number (any account) per rolling window — toll-fraud / pumping guard. */
export const SMS_PER_NUMBER_MAX = 5;
export const SMS_PER_NUMBER_WINDOW_MINUTES = 60;

/** TTL in minutes; override with OTP_TTL_MINUTES_<PURPOSE> (1–60), otherwise the default. */
export function otpTtlMinutes(purpose: OtpPurpose, env: NodeJS.ProcessEnv = process.env): number {
  const raw = Number(env[TTL_ENV[purpose]]);
  return Number.isInteger(raw) && raw >= 1 && raw <= 60 ? raw : DEFAULT_TTL_MINUTES[purpose];
}

/** Uniform, cryptographically secure numeric code (crypto.randomInt, not Math.random). */
export function generateOtp(length = OTP_LENGTH): string {
  return randomInt(0, 10 ** length).toString().padStart(length, '0');
}
