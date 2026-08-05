import { MigrationInterface, QueryRunner } from 'typeorm';

// Adds admin-side verification to match_fixed. External matches (FAMILY, FRIEND,
// OTHER_MATRIMONY, ...) have no matchedUserId, so no partner exists to confirm
// them — an admin verifies instead. verificationMethod records which path was used.
// Existing verified rows were all partner-confirmed, so they are backfilled to PARTNER.
export class AddMatchFixedVerificationMethod1784333100000 implements MigrationInterface {
  name = 'AddMatchFixedVerificationMethod1784333100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('match_fixed'))) return;

    if (!(await queryRunner.hasColumn('match_fixed', 'verificationMethod'))) {
      await queryRunner.query(
        `ALTER TABLE \`match_fixed\` ADD \`verificationMethod\` enum('PARTNER','ADMIN') NULL`,
      );
    }

    if (!(await queryRunner.hasColumn('match_fixed', 'verifiedByUserId'))) {
      await queryRunner.query(
        `ALTER TABLE \`match_fixed\` ADD \`verifiedByUserId\` varchar(255) NULL`,
      );
    }

    if (!(await queryRunner.hasColumn('match_fixed', 'verificationNote'))) {
      await queryRunner.query(
        `ALTER TABLE \`match_fixed\` ADD \`verificationNote\` text NULL`,
      );
    }

    // Backfill: everything verified before this migration came through the
    // partner-confirmation endpoint.
    await queryRunner.query(`
      UPDATE \`match_fixed\`
      SET \`verificationMethod\` = 'PARTNER',
          \`verifiedByUserId\` = \`verifiedByPartnerId\`
      WHERE \`isVerified\` = 1 AND \`verificationMethod\` IS NULL
    `);

    // Backs the admin "pending verification" listing and the verified-stories counts
    if (!(await this.hasIndex(queryRunner))) {
      await queryRunner.query(
        `CREATE INDEX \`IDX_MF_VERIFIED\` ON \`match_fixed\` (\`isVerified\`, \`status\`)`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('match_fixed'))) return;

    if (await this.hasIndex(queryRunner)) {
      await queryRunner.query(`DROP INDEX \`IDX_MF_VERIFIED\` ON \`match_fixed\``);
    }

    if (await queryRunner.hasColumn('match_fixed', 'verificationNote')) {
      await queryRunner.query(`ALTER TABLE \`match_fixed\` DROP COLUMN \`verificationNote\``);
    }
    if (await queryRunner.hasColumn('match_fixed', 'verifiedByUserId')) {
      await queryRunner.query(`ALTER TABLE \`match_fixed\` DROP COLUMN \`verifiedByUserId\``);
    }
    if (await queryRunner.hasColumn('match_fixed', 'verificationMethod')) {
      await queryRunner.query(`ALTER TABLE \`match_fixed\` DROP COLUMN \`verificationMethod\``);
    }
  }

  private async hasIndex(queryRunner: QueryRunner): Promise<boolean> {
    const rows = await queryRunner.query(
      `SHOW INDEX FROM \`match_fixed\` WHERE Key_name = 'IDX_MF_VERIFIED'`,
    );
    return Array.isArray(rows) && rows.length > 0;
  }
}
