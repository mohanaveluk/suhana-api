import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, IsNull, Repository } from 'typeorm';
import { createHash, randomBytes } from 'crypto';
import { User } from '../user/entity/user.entity';
import { RoleEntity } from '../user/entity/roles.entity';
import { UserAccountRole } from './entities/user-account-role.entity';
import { AuthHandoffCode } from './entities/auth-handoff-code.entity';
import {
  APP_TARGET_ROLES, AccountRole, AccountRoleSource, AppTarget, hasAnyRole,
} from './account-role.enum';

/** Handoff codes live 60 seconds and work once. */
const HANDOFF_TTL_MS = 60_000;

/**
 * One Aurora identity, many application roles.
 *
 * Effective roles of a user = rows in user_account_roles
 *   + ADMIN when the legacy tier (user.role_id → roles.name) is 'admin'
 *   + MEMBER for a legacy account with no rows at all whose account_type isn't PROVIDER
 *     (backward compatibility: every account that existed before roles were introduced
 *      keeps working even if the backfill migration hasn't run yet).
 *
 * Roles are only ever granted after the user proved they own the account
 * (signed in, or verified their email) — never because an email address exists.
 */
@Injectable()
export class AccountRolesService {
  constructor(
    @InjectRepository(UserAccountRole) private readonly roleRepo: Repository<UserAccountRole>,
    @InjectRepository(AuthHandoffCode) private readonly handoffRepo: Repository<AuthHandoffCode>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(RoleEntity) private readonly tierRepo: Repository<RoleEntity>,
  ) {}

  /** Effective roles for a user id (one or two small queries). */
  async rolesOf(userId: string): Promise<AccountRole[]> {
    const user = await this.userRepo.findOne({
      where: { id: userId },
      select: { id: true, role_id: true, account_type: true },
    });
    if (!user) return [];
    return this.effectiveRoles(user);
  }

  /** Effective roles when the user row (with role_id + account_type) is already loaded. */
  async effectiveRoles(user: Pick<User, 'id' | 'role_id' | 'account_type'>, tierName?: string | null): Promise<AccountRole[]> {
    const rows = await this.roleRepo.find({ where: { userId: user.id }, select: { role: true } });
    const roles = new Set<AccountRole>(rows.map((r) => r.role));
    const tier = tierName !== undefined ? tierName : await this.tierName(user.role_id);
    if (tier === 'admin') roles.add(AccountRole.ADMIN);
    if (!rows.length && (user.account_type ?? 'MEMBER') !== 'PROVIDER') roles.add(AccountRole.MEMBER);
    return [...roles].sort();
  }

  private async tierName(roleId: number | null | undefined): Promise<string | null> {
    if (!roleId) return null;
    const tier = await this.tierRepo.findOne({ where: { id: roleId }, select: { name: true } });
    return tier?.name ?? null;
  }

  /**
   * Grants a role (idempotent). Pass the transaction's EntityManager when the
   * grant must commit or roll back together with other writes.
   */
  async grant(userId: string, role: AccountRole, source: AccountRoleSource, grantedBy: string | null = null, m?: EntityManager): Promise<void> {
    const repo = m ? m.getRepository(UserAccountRole) : this.roleRepo;
    await repo.createQueryBuilder()
      .insert()
      .into(UserAccountRole)
      .values({ userId, role, source, grantedBy })
      .orIgnore() // UNIQUE (user_id, role): already held → no-op
      .execute();
    // A legacy account that never had rows was an implicit MEMBER; once it gets its first
    // explicit row, keep MEMBER explicit too so it doesn't silently lose member access.
    const user = await (m ? m.getRepository(User) : this.userRepo).findOne({ where: { id: userId }, select: { id: true, account_type: true } });
    if (role !== AccountRole.MEMBER && user && (user.account_type ?? 'MEMBER') !== 'PROVIDER') {
      const count = await repo.count({ where: { userId } });
      if (count === 1) {
        await repo.createQueryBuilder().insert().into(UserAccountRole)
          .values({ userId, role: AccountRole.MEMBER, source: AccountRoleSource.BACKFILL, grantedBy: null })
          .orIgnore().execute();
      }
    }
  }

  // ── Switching between the two web apps ──────────────────────────────────

  /** Issues a 60-second single-use code for the other app. The user must hold a role for it. */
  async createHandoff(userId: string, target: AppTarget): Promise<{ code: string; expiresInSeconds: number }> {
    const roles = await this.rolesOf(userId);
    if (!hasAnyRole(roles, APP_TARGET_ROLES[target])) {
      throw new ForbiddenException(target === 'providers'
        ? 'You don’t have a provider account yet. Register your business to get started.'
        : 'You don’t have an Aurora Matrimony profile yet.');
    }
    const code = randomBytes(32).toString('base64url');
    await this.handoffRepo.save(this.handoffRepo.create({
      codeHash: this.hash(code), userId, target, expiresAt: new Date(Date.now() + HANDOFF_TTL_MS), usedAt: null,
    }));
    return { code, expiresInSeconds: HANDOFF_TTL_MS / 1000 };
  }

  /**
   * Burns a handoff code and returns the user it belongs to. Fails when the code
   * is unknown, used, expired, for a different app, or the user no longer has a
   * role for that app. The UPDATE ... WHERE used_at IS NULL makes it single-use
   * even under concurrent requests.
   */
  async consumeHandoff(code: string, target: AppTarget): Promise<User> {
    const invalid = () => new UnauthorizedException('This sign-in link is invalid or has expired. Please sign in.');
    if (!code || code.length > 100) throw invalid();
    const codeHash = this.hash(code);
    const row = await this.handoffRepo.findOne({ where: { codeHash } });
    if (!row || row.target !== target || row.usedAt || row.expiresAt.getTime() < Date.now()) throw invalid();
    const res = await this.handoffRepo.update({ codeHash, usedAt: IsNull() }, { usedAt: new Date() });
    if (!res.affected) throw invalid();

    const user = await this.userRepo.findOne({ where: { id: row.userId, is_deleted: false }, relations: ['role'] });
    if (!user || user.is_active === 0 || !user.is_email_verified) throw invalid();
    if (!hasAnyRole(await this.effectiveRoles(user, user.role?.name ?? null), APP_TARGET_ROLES[target])) throw invalid();
    return user;
  }

  private hash(code: string): string {
    return createHash('sha256').update(code).digest('hex');
  }
}
