import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { REQUIRE_APP_ROLES_KEY } from '../decorators/require-app-roles.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { AccountRole, PROVIDER_APP_ROLES, hasAnyRole } from 'src/modules/account-roles/account-role.enum';

/**
 * Enforces @RequireAppRoles(...). Runs after JwtAuthGuard (needs request.user.roles).
 * Routes without the decorator pass. The error carries a machine-readable `code`
 * so each web app can show the right next step (e.g. "Register your business").
 */
@Injectable()
export class AppRolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [context.getHandler(), context.getClass()]);
    if (isPublic) return true;
    const wanted = this.reflector.getAllAndOverride<AccountRole[]>(REQUIRE_APP_ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!wanted?.length) return true;
    const roles: string[] = context.switchToHttp().getRequest().user?.roles ?? [];
    if (hasAnyRole(roles, wanted)) return true;

    const providerRoute = wanted.every((r) => PROVIDER_APP_ROLES.includes(r));
    throw new ForbiddenException(providerRoute
      ? { statusCode: 403, code: 'PROVIDER_ROLE_REQUIRED', message: 'You don’t have a provider account yet. Register your business to get started.' }
      : { statusCode: 403, code: 'ROLE_REQUIRED', message: 'Your account doesn’t have access to this feature.' });
  }
}
