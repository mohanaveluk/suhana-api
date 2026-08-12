/**
 * Marital status options for a matrimony profile.
 *
 * Values follow the convention used across Indian matrimony platforms
 * (BharatMatrimony, Shaadi, Jeevansathi) so they read naturally to members and
 * map cleanly onto imported data.
 *
 * Two deliberate choices:
 *
 * - **"Never Married" rather than "Single" or "Unmarried".** All three mean the
 *   same thing, but "Single" is ambiguous — it is also how divorced and widowed
 *   members describe themselves in everyday speech. The search dictionary
 *   accepts all three spellings and maps them here, so members can still *type*
 *   "single".
 *
 * - **No "Married" option.** A matrimony platform must not advertise members who
 *   are currently married; offering it as a profile state would invite exactly
 *   the misuse the platform exists to prevent. Members mid-divorce are covered
 *   by AWAITING_DIVORCE, which is honest about the situation.
 */
export enum MaritalStatus {
  /** Canonical for "single" / "unmarried" / "bachelor" / "spinster". */
  NEVER_MARRIED = 'Never Married',
  /** Separated, or divorce proceedings under way but not finalised. */
  AWAITING_DIVORCE = 'Awaiting Divorce',
  DIVORCED = 'Divorced',
  WIDOWED = 'Widowed',
  /** Marriage legally declared void — distinct from divorce in many communities. */
  ANNULLED = 'Annulled',
}

/** Ordered for display in a dropdown, commonest first. */
export const MARITAL_STATUS_VALUES: string[] = [
  MaritalStatus.NEVER_MARRIED,
  MaritalStatus.AWAITING_DIVORCE,
  MaritalStatus.DIVORCED,
  MaritalStatus.WIDOWED,
  MaritalStatus.ANNULLED,
];
