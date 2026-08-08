import { MigrationInterface, QueryRunner } from 'typeorm';

// Mobile number ownership verification.
//
// Adds user.is_mobile_verified and the mobile_verification_otp table that backs
// the OTP send/verify flow. Existing users are left at 0 (unverified) — nobody
// has proven ownership of their number yet, so claiming otherwise would be a lie.
export class AddMobileVerification1784333200000 implements MigrationInterface {
  name = 'AddMobileVerification1784333200000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── user.is_mobile_verified ──────────────────────────────────────────────
    if (
      (await queryRunner.hasTable('user')) &&
      !(await queryRunner.hasColumn('user', 'is_mobile_verified'))
    ) {
      await queryRunner.query(
        `ALTER TABLE \`user\` ADD \`is_mobile_verified\` tinyint NOT NULL DEFAULT 0`,
      );
    }

    // ── mobile_verification_otp ──────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`mobile_verification_otp\` (
        \`id\` varchar(36) NOT NULL,
        \`guid\` varchar(36) NOT NULL,
        \`user_id\` varchar(36) NOT NULL,
        \`mobile_number\` varchar(20) NOT NULL,
        \`otp_code\` varchar(255) NOT NULL,
        \`status\` enum('PENDING','VERIFIED','EXPIRED','FAILED') NOT NULL DEFAULT 'PENDING',
        \`attempt_count\` int NOT NULL DEFAULT 0,
        \`expires_at\` datetime NOT NULL,
        \`verified_at\` datetime NULL,
        \`sent_at\` datetime NULL,
        \`ip_address\` varchar(64) NULL,
        \`user_agent\` varchar(512) NULL,
        \`created_by\` varchar(36) NULL,
        \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        KEY \`IDX_MVO_USER_STATUS\` (\`user_id\`, \`status\`),
        KEY \`IDX_MVO_MOBILE_STATUS\` (\`mobile_number\`, \`status\`),
        KEY \`IDX_MVO_USER_CREATED\` (\`user_id\`, \`created_at\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // FK added separately so a pre-existing table (created by synchronize in dev)
    // does not cause a duplicate-constraint failure.
    const [fk] = await queryRunner.query(`
      SELECT CONSTRAINT_NAME FROM information_schema.TABLE_CONSTRAINTS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'mobile_verification_otp'
        AND CONSTRAINT_NAME = 'FK_MVO_USER'
    `);
    if (!fk) {
      await queryRunner.query(`
        ALTER TABLE \`mobile_verification_otp\`
        ADD CONSTRAINT \`FK_MVO_USER\` FOREIGN KEY (\`user_id\`)
        REFERENCES \`user\` (\`id\`) ON DELETE CASCADE
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS \`mobile_verification_otp\``);

    if (
      (await queryRunner.hasTable('user')) &&
      (await queryRunner.hasColumn('user', 'is_mobile_verified'))
    ) {
      await queryRunner.query(
        `ALTER TABLE \`user\` DROP COLUMN \`is_mobile_verified\``,
      );
    }
  }
}
