import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Aurora Discover — provider self-service ("For Providers").
 *
 * Reuses the existing `user` table / login / JWT for provider accounts:
 *   - user.gender becomes NULLable (provider-only accounts are not bride/groom)
 *   - user.account_type: MEMBER (default — every existing account) | PROVIDER
 *
 * Listing ownership on discovery_providers (existing rows keep today's behaviour):
 *   - management_type: ADMIN_MANAGED (default) | PROVIDER_MANAGED
 *   - listing_status:  PUBLISHED (default) | DRAFT | SUBMITTED | CHANGES_REQUESTED
 *   - review_note, submitted_at
 *   (existing user_id = primary owner, created_by = creator; nothing duplicated)
 *
 * New tables: discovery_provider_members (who may manage a listing),
 * discovery_listing_claims ("Claim this business" requests).
 *
 * Idempotent; no FKs (module convention). Must stay in step with the entities.
 */
export class AddDiscoveryProviderPortal1784334700000 implements MigrationInterface {
  name = 'AddDiscoveryProviderPortal1784334700000';

  private async hasColumn(q: QueryRunner, table: string, column: string): Promise<boolean> {
    const rows = await q.query(
      'SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?',
      [table, column],
    );
    return rows.length > 0;
  }

  private async hasIndex(q: QueryRunner, table: string, index: string): Promise<boolean> {
    const rows = await q.query(
      'SELECT 1 FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?',
      [table, index],
    );
    return rows.length > 0;
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── user ────────────────────────────────────────────────────────────────
    await queryRunner.query("ALTER TABLE `user` MODIFY `gender` enum('bride','groom') NULL");
    if (!(await this.hasColumn(queryRunner, 'user', 'account_type'))) {
      await queryRunner.query("ALTER TABLE `user` ADD `account_type` varchar(16) NOT NULL DEFAULT 'MEMBER'");
    }

    // ── discovery_providers ─────────────────────────────────────────────────
    if (!(await this.hasColumn(queryRunner, 'discovery_providers', 'management_type'))) {
      await queryRunner.query("ALTER TABLE `discovery_providers` ADD `management_type` varchar(20) NOT NULL DEFAULT 'ADMIN_MANAGED'");
    }
    if (!(await this.hasColumn(queryRunner, 'discovery_providers', 'listing_status'))) {
      await queryRunner.query("ALTER TABLE `discovery_providers` ADD `listing_status` varchar(20) NOT NULL DEFAULT 'PUBLISHED'");
    }
    if (!(await this.hasColumn(queryRunner, 'discovery_providers', 'review_note'))) {
      await queryRunner.query('ALTER TABLE `discovery_providers` ADD `review_note` varchar(500) NULL');
    }
    if (!(await this.hasColumn(queryRunner, 'discovery_providers', 'submitted_at'))) {
      await queryRunner.query('ALTER TABLE `discovery_providers` ADD `submitted_at` datetime NULL');
    }
    if (!(await this.hasIndex(queryRunner, 'discovery_providers', 'IDX_DISCOVERY_PROVIDERS_LISTING'))) {
      await queryRunner.query(
        'CREATE INDEX `IDX_DISCOVERY_PROVIDERS_LISTING` ON `discovery_providers` (`listing_status`, `management_type`)',
      );
    }

    // ── members / claims ────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`discovery_provider_members\` (
        \`provider_id\` varchar(36) NOT NULL,
        \`user_id\` varchar(36) NOT NULL,
        \`role\` varchar(16) NOT NULL DEFAULT 'OWNER',
        \`created_by\` varchar(36) NULL,
        \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        INDEX \`IDX_DISCOVERY_PROVIDER_MEMBERS_USER\` (\`user_id\`),
        PRIMARY KEY (\`provider_id\`, \`user_id\`)
      ) ENGINE=InnoDB`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`discovery_listing_claims\` (
        \`id\` varchar(36) NOT NULL,
        \`provider_id\` varchar(36) NOT NULL,
        \`user_id\` varchar(36) NOT NULL,
        \`status\` varchar(16) NOT NULL DEFAULT 'PENDING',
        \`message\` varchar(1000) NULL,
        \`contact_name\` varchar(150) NULL,
        \`contact_phone\` varchar(32) NULL,
        \`business_email\` varchar(255) NULL,
        \`admin_note\` varchar(500) NULL,
        \`reviewed_by\` varchar(36) NULL,
        \`reviewed_at\` datetime NULL,
        \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        INDEX \`IDX_DISCOVERY_LISTING_CLAIMS_STATUS\` (\`status\`, \`created_at\`),
        INDEX \`IDX_DISCOVERY_LISTING_CLAIMS_PROVIDER\` (\`provider_id\`, \`status\`),
        INDEX \`IDX_DISCOVERY_LISTING_CLAIMS_USER\` (\`user_id\`),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS `discovery_listing_claims`');
    await queryRunner.query('DROP TABLE IF EXISTS `discovery_provider_members`');
    if (await this.hasIndex(queryRunner, 'discovery_providers', 'IDX_DISCOVERY_PROVIDERS_LISTING')) {
      await queryRunner.query('DROP INDEX `IDX_DISCOVERY_PROVIDERS_LISTING` ON `discovery_providers`');
    }
    for (const col of ['submitted_at', 'review_note', 'listing_status', 'management_type']) {
      if (await this.hasColumn(queryRunner, 'discovery_providers', col)) {
        await queryRunner.query(`ALTER TABLE \`discovery_providers\` DROP COLUMN \`${col}\``);
      }
    }
    if (await this.hasColumn(queryRunner, 'user', 'account_type')) {
      await queryRunner.query('ALTER TABLE `user` DROP COLUMN `account_type`');
    }
    // Provider-only accounts have no gender; give them a value before restoring NOT NULL.
    await queryRunner.query("UPDATE `user` SET `gender` = 'bride' WHERE `gender` IS NULL");
    await queryRunner.query("ALTER TABLE `user` MODIFY `gender` enum('bride','groom') NOT NULL");
  }
}
