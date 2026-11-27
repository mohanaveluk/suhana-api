/**
 * Application roles of an Aurora identity. One user (one email, one password)
 * can hold several: e.g. MEMBER + PROVIDER for a matrimony member who also
 * lists a business.
 *
 * These are separate from the legacy `user.role_id` tier (admin / registered /
 * guest / tester / user), which stays as-is so existing admin and tester
 * behaviour is untouched. ADMIN is *derived* from role_id = 'admin' (and may
 * also be stored here); SUPER_ADMIN exists only as a stored role.
 */
export enum AccountRole {
  MEMBER = 'MEMBER',
  PROVIDER = 'PROVIDER',
  PROVIDER_STAFF = 'PROVIDER_STAFF',
  ADMIN = 'ADMIN',
  SUPER_ADMIN = 'SUPER_ADMIN',
}

/** Where a role grant came from (audit / support). */
export enum AccountRoleSource {
  BACKFILL = 'BACKFILL',
  MEMBER_REGISTRATION = 'MEMBER_REGISTRATION',
  MEMBER_JOIN = 'MEMBER_JOIN',
  PROVIDER_REGISTRATION = 'PROVIDER_REGISTRATION',
  PROVIDER_ONBOARDING = 'PROVIDER_ONBOARDING',
  LISTING_MEMBERSHIP = 'LISTING_MEMBERSHIP',
  ADMIN = 'ADMIN',
}

/** Roles that may use Aurora Matrimony (member app). */
export const MEMBER_APP_ROLES: readonly AccountRole[] = [AccountRole.MEMBER, AccountRole.ADMIN, AccountRole.SUPER_ADMIN];
/** Roles that may use Aurora for Providers (business dashboard). */
export const PROVIDER_APP_ROLES: readonly AccountRole[] = [AccountRole.PROVIDER, AccountRole.PROVIDER_STAFF];

export const hasAnyRole = (roles: readonly string[] | undefined, wanted: readonly AccountRole[]): boolean =>
  !!roles?.some((r) => (wanted as readonly string[]).includes(r));

export type AppTarget = 'matrimony' | 'providers';
export const APP_TARGET_ROLES: Record<AppTarget, readonly AccountRole[]> = {
  matrimony: MEMBER_APP_ROLES,
  providers: PROVIDER_APP_ROLES,
};
