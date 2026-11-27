import { ExecutionContext } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { AppRolesGuard } from 'src/common/guards/app-roles.guard';
import { AdminDiscoveryController } from './admin-discovery.controller';
import { DiscoveryController } from './discovery.controller';
import { ProviderPortalController } from './provider-portal.controller';
import { IS_PUBLIC_KEY } from 'src/common/decorators/public.decorator';

/** "Unauthorized modification": members can't reach admin writes; nobody reaches anything without a JWT. */
describe('Aurora Discover authorization', () => {
  const guard = new RolesGuard(new Reflector());
  const ctx = (handler: (...a: any[]) => any, role: string): ExecutionContext =>
    ({
      getHandler: () => handler,
      getClass: () => AdminDiscoveryController,
      switchToHttp: () => ({ getRequest: () => ({ user: { id: 'u1', role } }) }),
    }) as unknown as ExecutionContext;

  const adminWrites = [
    'createProvider', 'updateProvider', 'deleteProvider', 'restoreProvider', 'setVerification', 'addLocation',
    'updateLocation', 'deleteLocation', 'uploadMedia', 'deleteMedia', 'moderateReview', 'updateCategory',
    'reviewSubmission', 'setManagement', 'decideClaim', 'listClaims',
  ] as const;

  it.each(adminWrites)('member (role=user) is refused on admin %s', (name) => {
    expect(guard.canActivate(ctx(AdminDiscoveryController.prototype[name], 'user'))).toBe(false);
    expect(guard.canActivate(ctx(AdminDiscoveryController.prototype[name], ''))).toBe(false);
  });

  it.each(adminWrites)('admin is allowed on %s', (name) => {
    expect(guard.canActivate(ctx(AdminDiscoveryController.prototype[name], 'admin'))).toBe(true);
  });

  it('admin controller requires JWT then role', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, AdminDiscoveryController)).toEqual([JwtAuthGuard, RolesGuard]);
  });

  it('member controller requires a JWT on every route', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, DiscoveryController)).toEqual([JwtAuthGuard]);
  });

  it('provider portal requires a JWT (+ app-role check) everywhere except registration, resend and the category list', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, ProviderPortalController)).toEqual([JwtAuthGuard, AppRolesGuard]);
    const isPublic = (name: keyof ProviderPortalController) =>
      Reflect.getMetadata(IS_PUBLIC_KEY, ProviderPortalController.prototype[name]) === true;
    expect(isPublic('register')).toBe(true);
    expect(isPublic('categories')).toBe(true);
    expect(isPublic('resendVerification')).toBe(true);
    for (const name of ['me', 'onboard', 'createListing', 'getListing', 'updateListing', 'submit', 'createClaim', 'uploadMedia'] as const) {
      expect(isPublic(name)).toBe(false);
    }
  });
});
