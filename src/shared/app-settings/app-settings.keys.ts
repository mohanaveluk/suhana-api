/** Known setting keys and their defaults (used when the row is missing). */
export const APP_SETTING = {
  /** Site-wide SMS kill switch. Effective only when Telnyx is also configured (TELNYX_ENABLED). */
  SMS_SENDING_ENABLED: 'sms_sending_enabled',
} as const;

export type AppSettingKey = (typeof APP_SETTING)[keyof typeof APP_SETTING];

export const APP_SETTING_DEFAULTS: Record<AppSettingKey, string> = {
  [APP_SETTING.SMS_SENDING_ENABLED]: 'true',
};
