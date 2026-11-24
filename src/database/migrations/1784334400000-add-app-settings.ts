import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * app_settings: site-wide runtime switches flipped from the admin panel (no deploy needed).
 * Seeds sms_sending_enabled = 'true' so behaviour is unchanged until an admin turns SMS off
 * (SMS still also requires TELNYX_ENABLED + credentials). Idempotent.
 */
export class AddAppSettings1784334400000 implements MigrationInterface {
  name = 'AddAppSettings1784334400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('app_settings'))) {
      await queryRunner.query(`
        CREATE TABLE \`app_settings\` (
          \`setting_key\` varchar(64) NOT NULL,
          \`setting_value\` varchar(255) NOT NULL,
          \`updated_by\` varchar(36) NULL,
          \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
          PRIMARY KEY (\`setting_key\`)
        ) ENGINE=InnoDB`);
    }
    await queryRunner.query(
      "INSERT IGNORE INTO `app_settings` (`setting_key`, `setting_value`) VALUES ('sms_sending_enabled', 'true')",
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('app_settings')) await queryRunner.query('DROP TABLE `app_settings`');
  }
}
