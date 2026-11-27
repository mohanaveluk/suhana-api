import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Shared Aurora identity with multiple application roles.
 *
 * One `user` row per person (one email, one password). What they may use is a
 * set of roles in the new `user_account_roles` table:
 *   MEMBER (Aurora Matrimony), PROVIDER / PROVIDER_STAFF (Aurora for Providers),
 *   ADMIN / SUPER_ADMIN.
 * The legacy `user.role_id` tier (admin / registered / guest / tester / user) is
 * NOT changed — existing admin and tester behaviour stays exactly as it is
 * (ADMIN is derived from role_id = 'admin' at runtime). `user.account_type` is
 * kept as "where the account was first created" for backward compatibility.
 *
 * Backfill (no duplicate users, nothing deleted):
 *   - MEMBER          every account whose account_type is MEMBER (all pre-provider accounts)
 *   - PROVIDER        every PROVIDER account, and anyone who OWNS a Discover listing
 *   - PROVIDER_STAFF  anyone who is STAFF on a Discover listing
 * A matrimony member who already added a business therefore gets MEMBER + PROVIDER.
 *
 * Also adds `auth_handoff_codes` (single-use codes for switching between the two
 * web apps without signing in again; only SHA-256 hashes are stored).
 *
 * Idempotent; no FKs (module convention). Must stay in step with the entities.
 */
export class AddUserAccountRoles1784334800000 implements MigrationInterface {
  name = 'AddUserAccountRoles1784334800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`user_account_roles\` (
        \`id\` bigint NOT NULL AUTO_INCREMENT,
        \`user_id\` varchar(36) NOT NULL,
        \`role\` varchar(32) NOT NULL,
        \`source\` varchar(40) NOT NULL,
        \`granted_by\` varchar(36) NULL,
        \`granted_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        UNIQUE INDEX \`UQ_USER_ACCOUNT_ROLES_USER_ROLE\` (\`user_id\`, \`role\`),
        INDEX \`IDX_USER_ACCOUNT_ROLES_USER\` (\`user_id\`),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`auth_handoff_codes\` (
        \`code_hash\` char(64) NOT NULL,
        \`user_id\` varchar(36) NOT NULL,
        \`target\` varchar(16) NOT NULL,
        \`expires_at\` datetime NOT NULL,
        \`used_at\` datetime NULL,
        \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        INDEX \`IDX_AUTH_HANDOFF_CODES_USER\` (\`user_id\`),
        PRIMARY KEY (\`code_hash\`)
      ) ENGINE=InnoDB`);

    // ── Backfill (INSERT IGNORE: re-running never duplicates) ────────────────
    await queryRunner.query(`
      INSERT IGNORE INTO \`user_account_roles\` (\`user_id\`, \`role\`, \`source\`)
      SELECT u.\`id\`, 'MEMBER', 'BACKFILL' FROM \`user\` u
      WHERE COALESCE(u.\`account_type\`, 'MEMBER') = 'MEMBER'`);

    await queryRunner.query(`
      INSERT IGNORE INTO \`user_account_roles\` (\`user_id\`, \`role\`, \`source\`)
      SELECT u.\`id\`, 'PROVIDER', 'BACKFILL' FROM \`user\` u
      WHERE u.\`account_type\` = 'PROVIDER'`);

    if (await queryRunner.hasTable('discovery_provider_members')) {
      await queryRunner.query(`
        INSERT IGNORE INTO \`user_account_roles\` (\`user_id\`, \`role\`, \`source\`)
        SELECT DISTINCT m.\`user_id\`, 'PROVIDER', 'BACKFILL' FROM \`discovery_provider_members\` m
        WHERE m.\`role\` = 'OWNER'`);
      await queryRunner.query(`
        INSERT IGNORE INTO \`user_account_roles\` (\`user_id\`, \`role\`, \`source\`)
        SELECT DISTINCT m.\`user_id\`, 'PROVIDER_STAFF', 'BACKFILL' FROM \`discovery_provider_members\` m
        WHERE m.\`role\` = 'STAFF'`);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Dropping restores the previous behaviour (account_type + memberships), which is
    // still fully populated: this migration never changes or removes existing data.
    await queryRunner.query('DROP TABLE IF EXISTS `auth_handoff_codes`');
    await queryRunner.query('DROP TABLE IF EXISTS `user_account_roles`');
  }
}
