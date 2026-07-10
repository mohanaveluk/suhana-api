export enum SafetyCategory {
  ACCOUNT_SECURITY = 'ACCOUNT_SECURITY',
  PROFILE_VERIFICATION = 'PROFILE_VERIFICATION',
  COMMUNICATION = 'COMMUNICATION',
  MEETING_IN_PERSON = 'MEETING_IN_PERSON',
  FINANCIAL_SAFETY = 'FINANCIAL_SAFETY',
  ONLINE_SAFETY = 'ONLINE_SAFETY',
  PRIVACY = 'PRIVACY',
  REPORTING_ABUSE = 'REPORTING_ABUSE',
}

export const SAFETY_CATEGORY_LABELS: Record<SafetyCategory, string> = {
  [SafetyCategory.ACCOUNT_SECURITY]: 'Account Security',
  [SafetyCategory.PROFILE_VERIFICATION]: 'Profile Verification',
  [SafetyCategory.COMMUNICATION]: 'Communication Safety',
  [SafetyCategory.MEETING_IN_PERSON]: 'Meeting In Person',
  [SafetyCategory.FINANCIAL_SAFETY]: 'Financial Safety',
  [SafetyCategory.ONLINE_SAFETY]: 'Online Safety',
  [SafetyCategory.PRIVACY]: 'Privacy Protection',
  [SafetyCategory.REPORTING_ABUSE]: 'Reporting Abuse',
};
