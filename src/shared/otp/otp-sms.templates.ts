/**
 * SMS bodies for one-time codes. Kept short (one GSM-7 segment where possible), no links,
 * brand first so recipients recognise the sender. The code is only ever placed in the text sent
 * to the provider — never logged or stored.
 */
const BRAND = 'Aurora Matrimony';

export const otpSmsTemplates = {
  mobileVerification: (code: string, minutes: number) =>
    `${BRAND}: Your verification code is ${code}. It expires in ${minutes} minutes. Do not share this code with anyone.`,
  login: (code: string, minutes: number) =>
    `${BRAND}: Your login code is ${code}. It expires in ${minutes} minutes. If you did not request this, ignore this message.`,
  passwordReset: (code: string, minutes: number) =>
    `${BRAND}: Your password reset code is ${code}. It expires in ${minutes} minutes. If you did not request this, please secure your account.`,
  mobileVerified: () =>
    `${BRAND}: Your mobile number has been verified successfully. Thank you for verifying your account.`,
};
