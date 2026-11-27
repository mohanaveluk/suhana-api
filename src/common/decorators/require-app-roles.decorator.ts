import { SetMetadata } from '@nestjs/common';
import { AccountRole } from 'src/modules/account-roles/account-role.enum';

export const REQUIRE_APP_ROLES_KEY = 'requireAppRoles';

/**
 * Route needs at least one of these application roles (checked by AppRolesGuard,
 * from `request.user.roles` which JwtStrategy reads from the DB on every request).
 * Example: provider dashboard endpoints → @RequireAppRoles(AccountRole.PROVIDER, AccountRole.PROVIDER_STAFF).
 * Per-listing permission (OWNER/STAFF of *that* listing) is still checked by the service.
 */
export const RequireAppRoles = (...roles: AccountRole[]) => SetMetadata(REQUIRE_APP_ROLES_KEY, roles);
