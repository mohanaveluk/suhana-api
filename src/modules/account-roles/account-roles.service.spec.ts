import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { createHash } from 'crypto';
import { AccountRolesService } from './account-roles.service';
import { AccountRole, AccountRoleSource } from './account-role.enum';

/** In-memory stand-ins for the two role tables + user table. */
function setup(opts: { rows?: { userId: string; role: AccountRole }[]; users?: any[]; tiers?: Record<number, string> } = {}) {
  const rows = [...(opts.rows ?? [])];
  const handoffs: any[] = [];
  const users = opts.users ?? [];
  const tiers = opts.tiers ?? { 1: 'admin', 3: 'registered' };

  const insertBuilder = () => {
    let vals: any;
    const b: any = {
      insert: () => b, into: () => b, orIgnore: () => b,
      values: (v: any) => { vals = v; return b; },
      execute: async () => {
        if (!rows.some((r) => r.userId === vals.userId && r.role === vals.role)) rows.push({ userId: vals.userId, role: vals.role });
      },
    };
    return b;
  };
  const roleRepo: any = {
    find: jest.fn(async ({ where }) => rows.filter((r) => r.userId === where.userId)),
    count: jest.fn(async ({ where }) => rows.filter((r) => r.userId === where.userId).length),
    createQueryBuilder: insertBuilder,
  };
  const handoffRepo: any = {
    create: (x: any) => x,
    save: jest.fn(async (x: any) => { handoffs.push({ ...x }); return x; }),
    findOne: jest.fn(async ({ where }) => handoffs.find((h) => h.codeHash === where.codeHash) ?? null),
    update: jest.fn(async (where: any, patch: any) => {
      const h = handoffs.find((x) => x.codeHash === where.codeHash && !x.usedAt);
      if (!h) return { affected: 0 };
      Object.assign(h, patch);
      return { affected: 1 };
    }),
  };
  const userRepo: any = { findOne: jest.fn(async ({ where }) => users.find((u) => u.id === where.id) ?? null) };
  const tierRepo: any = { findOne: jest.fn(async ({ where }) => (tiers[where.id] ? { name: tiers[where.id] } : null)) };
  const svc = new AccountRolesService(roleRepo, handoffRepo, userRepo, tierRepo);
  return { svc, rows, handoffs };
}

const member = { id: 'm1', role_id: 3, account_type: 'MEMBER', is_deleted: false, is_active: 1, is_email_verified: true };
const provider = { id: 'p1', role_id: 3, account_type: 'PROVIDER', is_deleted: false, is_active: 1, is_email_verified: true };
const admin = { id: 'a1', role_id: 1, account_type: 'MEMBER', is_deleted: false, is_active: 1, is_email_verified: true };

describe('AccountRolesService — effective roles', () => {
  it('stored rows are the roles; MEMBER + PROVIDER both count', async () => {
    const { svc } = setup({ users: [member], rows: [{ userId: 'm1', role: AccountRole.MEMBER }, { userId: 'm1', role: AccountRole.PROVIDER }] });
    expect(await svc.rolesOf('m1')).toEqual([AccountRole.MEMBER, AccountRole.PROVIDER]);
  });

  it('legacy admin tier (role_id → admin) adds ADMIN without touching admin auth', async () => {
    const { svc } = setup({ users: [admin], rows: [{ userId: 'a1', role: AccountRole.MEMBER }] });
    expect(await svc.rolesOf('a1')).toEqual([AccountRole.ADMIN, AccountRole.MEMBER]);
  });

  it('a pre-roles member account with no rows is still a MEMBER (backward compatible)', async () => {
    const { svc } = setup({ users: [member] });
    expect(await svc.rolesOf('m1')).toEqual([AccountRole.MEMBER]);
  });

  it('a provider-only account with no rows is NOT implicitly a member', async () => {
    const { svc } = setup({ users: [provider] });
    expect(await svc.rolesOf('p1')).toEqual([]);
  });

  it('granting is idempotent', async () => {
    const { svc, rows } = setup({ users: [provider] });
    await svc.grant('p1', AccountRole.PROVIDER, AccountRoleSource.PROVIDER_REGISTRATION);
    await svc.grant('p1', AccountRole.PROVIDER, AccountRoleSource.PROVIDER_REGISTRATION);
    expect(rows.filter((r) => r.userId === 'p1')).toHaveLength(1);
  });

  it('a legacy member who adds a business keeps MEMBER explicitly (no silent loss of member access)', async () => {
    const { svc } = setup({ users: [member] });
    await svc.grant('m1', AccountRole.PROVIDER, AccountRoleSource.LISTING_MEMBERSHIP);
    expect(await svc.rolesOf('m1')).toEqual([AccountRole.MEMBER, AccountRole.PROVIDER]);
  });
});

describe('AccountRolesService — switching apps (handoff codes)', () => {
  const both = { userId: 'm1', role: AccountRole.MEMBER };
  const prov = { userId: 'm1', role: AccountRole.PROVIDER };

  it('issues a code only for an app the user has a role for', async () => {
    const { svc } = setup({ users: [member], rows: [both] });
    await expect(svc.createHandoff('m1', 'providers')).rejects.toBeInstanceOf(ForbiddenException);
    await expect(svc.createHandoff('m1', 'matrimony')).resolves.toMatchObject({ expiresInSeconds: 60 });
  });

  it('stores only a hash; the code works exactly once, for its own app', async () => {
    const { svc, handoffs } = setup({ users: [member], rows: [both, prov] });
    const { code } = await svc.createHandoff('m1', 'providers');
    expect(handoffs[0].codeHash).toBe(createHash('sha256').update(code).digest('hex'));
    expect(JSON.stringify(handoffs)).not.toContain(code);

    await expect(svc.consumeHandoff(code, 'matrimony')).rejects.toBeInstanceOf(UnauthorizedException); // wrong app
    await expect(svc.consumeHandoff(code, 'providers')).resolves.toMatchObject({ id: 'm1' });
    await expect(svc.consumeHandoff(code, 'providers')).rejects.toBeInstanceOf(UnauthorizedException); // reused
  });

  it('expired codes are refused', async () => {
    const { svc, handoffs } = setup({ users: [member], rows: [both, prov] });
    const { code } = await svc.createHandoff('m1', 'providers');
    handoffs[0].expiresAt = new Date(Date.now() - 1000);
    await expect(svc.consumeHandoff(code, 'providers')).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('unknown or garbage codes are refused', async () => {
    const { svc } = setup({ users: [member], rows: [both] });
    await expect(svc.consumeHandoff('nope', 'matrimony')).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(svc.consumeHandoff('x'.repeat(500), 'matrimony')).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
