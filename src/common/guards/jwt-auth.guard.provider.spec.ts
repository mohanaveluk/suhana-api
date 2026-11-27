import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { JwtAuthGuard } from './jwt-auth.guard';
import { OptionalJwtAuthGuard } from './optional-jwt-auth.guard';
import { AppRolesGuard } from './app-roles.guard';
import { ALLOW_PROVIDER_ACCOUNTS_KEY } from '../decorators/allow-provider-accounts.decorator';
import { REQUIRE_APP_ROLES_KEY } from '../decorators/require-app-roles.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { ProviderPortalController } from '../../modules/discovery/controllers/provider-portal.controller';
import { AccountRole } from '../../modules/account-roles/account-role.enum';

/**
 * One Aurora identity, several application roles — enforced on the server, not
 * just by the two web apps. Member routes need MEMBER (or ADMIN); the provider
 * dashboard needs PROVIDER / PROVIDER_STAFF; a user with both can use both.
 */
describe('JwtAuthGuard — application roles', () => {
  const reflector = new Reflector();
  const jwt = { verifyAsync: jest.fn().mockResolvedValue({ sub: 'u1' }) };
  const guard = new JwtAuthGuard(jwt as any, reflector);
  let request: any;

  const ctx = (handler: (...a: any[]) => any, cls: any): ExecutionContext =>
    ({ getHandler: () => handler, getClass: () => cls, switchToHttp: () => ({ getRequest: () => request }) }) as any;
  const asUser = (roles: string[]) =>
    jest.spyOn(AuthGuard('jwt').prototype, 'canActivate').mockImplementation(async function () {
      request.user = { id: 'u1', roles };
      return true;
    });

  class MemberController { search() { return 1; } }
  class PortalLike { me() { return 1; } }
  Reflect.defineMetadata(ALLOW_PROVIDER_ACCOUNTS_KEY, true, PortalLike);

  beforeEach(() => { request = { headers: { authorization: 'Bearer t' } }; });
  afterEach(() => jest.restoreAllMocks());

  it('a provider-only account is refused on member routes, with a machine-readable code', async () => {
    asUser([AccountRole.PROVIDER]);
    const err = await guard.canActivate(ctx(MemberController.prototype.search, MemberController)).catch((e) => e);
    expect(err).toBeInstanceOf(ForbiddenException);
    expect((err as ForbiddenException).getResponse()).toMatchObject({ code: 'MEMBER_ROLE_REQUIRED' });
  });

  it('a provider-only account is allowed on routes marked @AllowProviderAccounts', async () => {
    asUser([AccountRole.PROVIDER]);
    await expect(guard.canActivate(ctx(PortalLike.prototype.me, PortalLike))).resolves.toBe(true);
  });

  it('MEMBER, MEMBER + PROVIDER and ADMIN accounts may use member routes', async () => {
    for (const roles of [[AccountRole.MEMBER], [AccountRole.MEMBER, AccountRole.PROVIDER], [AccountRole.ADMIN]]) {
      asUser(roles);
      await expect(guard.canActivate(ctx(MemberController.prototype.search, MemberController))).resolves.toBe(true);
      jest.restoreAllMocks();
    }
  });

  it('the provider portal controller opts in', () => {
    expect(Reflect.getMetadata(ALLOW_PROVIDER_ACCOUNTS_KEY, ProviderPortalController)).toBe(true);
  });

  it('OptionalJwtAuthGuard treats an account without a member role as an anonymous visitor (roles from the DB)', async () => {
    const roles = { rolesOf: jest.fn(async (id: string) => (id === 'p1' ? [AccountRole.PROVIDER] : [AccountRole.MEMBER])) };
    const opt = new OptionalJwtAuthGuard({ verifyAsync: jest.fn().mockResolvedValue({ sub: 'p1' }) } as any, roles as any);
    const req: any = { headers: { authorization: 'Bearer t' } };
    await opt.canActivate({ switchToHttp: () => ({ getRequest: () => req }) } as any);
    expect(req.user).toBeUndefined();

    const opt2 = new OptionalJwtAuthGuard({ verifyAsync: jest.fn().mockResolvedValue({ sub: 'm1' }) } as any, roles as any);
    const req2: any = { headers: { authorization: 'Bearer t' } };
    await opt2.canActivate({ switchToHttp: () => ({ getRequest: () => req2 }) } as any);
    expect(req2.user).toMatchObject({ id: 'm1', roles: [AccountRole.MEMBER] });
  });
});

describe('AppRolesGuard — provider dashboard needs PROVIDER / PROVIDER_STAFF', () => {
  const guard = new AppRolesGuard(new Reflector());
  const ctx = (handler: any, roles: string[] | undefined): ExecutionContext =>
    ({
      getHandler: () => handler,
      getClass: () => ProviderPortalController,
      switchToHttp: () => ({ getRequest: () => ({ user: roles ? { id: 'u1', roles } : undefined }) }),
    }) as any;
  const p = ProviderPortalController.prototype as any;

  it('the controller requires a provider role by default', () => {
    expect(Reflect.getMetadata(REQUIRE_APP_ROLES_KEY, ProviderPortalController))
      .toEqual([AccountRole.PROVIDER, AccountRole.PROVIDER_STAFF]);
  });

  it('a MEMBER-only account is refused on listing endpoints with PROVIDER_ROLE_REQUIRED', () => {
    let err: any;
    try { guard.canActivate(ctx(p.getListing, [AccountRole.MEMBER])); } catch (e) { err = e; }
    expect(err).toBeInstanceOf(ForbiddenException);
    expect(err.getResponse()).toMatchObject({ code: 'PROVIDER_ROLE_REQUIRED' });
  });

  it('PROVIDER and PROVIDER_STAFF may use listing endpoints', () => {
    expect(guard.canActivate(ctx(p.getListing, [AccountRole.PROVIDER]))).toBe(true);
    expect(guard.canActivate(ctx(p.updateListing, [AccountRole.PROVIDER_STAFF]))).toBe(true);
    expect(guard.canActivate(ctx(p.getListing, [AccountRole.MEMBER, AccountRole.PROVIDER]))).toBe(true);
  });

  it('me, onboard and claims are open to any signed-in account (a member registering a business)', () => {
    for (const h of [p.me, p.onboard, p.claimable, p.createClaim, p.cancelClaim]) {
      expect(guard.canActivate(ctx(h, [AccountRole.MEMBER]))).toBe(true);
    }
  });

  it('public endpoints (register, resend, categories) skip the role check', () => {
    for (const h of [p.register, p.resendVerification, p.categories]) {
      expect(Reflect.getMetadata(IS_PUBLIC_KEY, h)).toBe(true);
      expect(guard.canActivate(ctx(h, undefined))).toBe(true);
    }
  });
});
