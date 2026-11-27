import { SetMetadata } from '@nestjs/common';

export const ALLOW_PROVIDER_ACCOUNTS_KEY = 'allowProviderAccounts';

/**
 * Aurora has two audiences on one identity system: members (bride/groom,
 * `user.account_type = MEMBER`) and business providers (`PROVIDER`, created by
 * Aurora for Providers). JwtAuthGuard refuses provider-only accounts on every
 * route EXCEPT those marked with this decorator (provider portal, auth/session
 * endpoints), so a business account can never use member features — even by
 * calling the API directly.
 *
 * A MEMBER who also owns a business is unaffected (they are still a member).
 */
export const AllowProviderAccounts = () => SetMetadata(ALLOW_PROVIDER_ACCOUNTS_KEY, true);
