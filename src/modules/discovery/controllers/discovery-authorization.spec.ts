import { ExecutionContext } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { AdminDiscoveryController } from './admin-discovery.controller';
import { DiscoveryController } from './discovery.controller';

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
});
