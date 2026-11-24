import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Telnyx SMS delivery:
 *  - sms_messages: one row per outbound SMS (delivery tracking + per-number rate limits).
 *    Stores NO message content and no full phone number (masked + SHA-256 only).
 *  - login_otc_tokens / password_reset_tokens: attemptCount (brute-force lock-out) and
 *    channel ('email' | 'sms'). Existing rows default to 0 / 'email'.
 * Idempotent, like the other migrations in this folder.
 */
export class AddSmsMessagesAndOtpAttempts1784334300000 implements MigrationInterface {
  name = 'AddSmsMessagesAndOtpAttempts1784334300000';

  private readonly otpTables = ['login_otc_tokens', 'password_reset_tokens'];

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('sms_messages'))) {
      await queryRunner.query(`
        CREATE TABLE \`sms_messages\` (
          \`id\` varchar(36) NOT NULL,
          \`user_id\` varchar(36) NULL,
          \`recipient_masked\` varchar(24) NOT NULL,
          \`recipient_hash\` char(64) NOT NULL,
          \`sms_type\` varchar(40) NOT NULL,
          \`provider\` varchar(20) NOT NULL,
          \`provider_message_id\` varchar(64) NULL,
          \`status\` enum('QUEUED','ACCEPTED','SENT','DELIVERED','FAILED','UNKNOWN') NOT NULL DEFAULT 'QUEUED',
          \`error_code\` varchar(40) NULL,
          \`last_event_id\` varchar(64) NULL,
          \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
          \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
          PRIMARY KEY (\`id\`),
          UNIQUE INDEX \`UQ_sms_messages_provider_message_id\` (\`provider_message_id\`),
          INDEX \`IDX_sms_messages_recipient_created\` (\`recipient_hash\`, \`created_at\`),
          INDEX \`IDX_sms_messages_user_created\` (\`user_id\`, \`created_at\`)
        ) ENGINE=InnoDB`);
    }

    for (const table of this.otpTables) {
      if (!(await queryRunner.hasTable(table))) continue;
      if (!(await queryRunner.hasColumn(table, 'attemptCount'))) {
        await queryRunner.query(`ALTER TABLE \`${table}\` ADD \`attemptCount\` int NOT NULL DEFAULT 0`);
      }
      if (!(await queryRunner.hasColumn(table, 'channel'))) {
        await queryRunner.query(`ALTER TABLE \`${table}\` ADD \`channel\` varchar(8) NOT NULL DEFAULT 'email'`);
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const table of this.otpTables) {
      if (!(await queryRunner.hasTable(table))) continue;
      if (await queryRunner.hasColumn(table, 'channel')) await queryRunner.query(`ALTER TABLE \`${table}\` DROP COLUMN \`channel\``);
      if (await queryRunner.hasColumn(table, 'attemptCount')) await queryRunner.query(`ALTER TABLE \`${table}\` DROP COLUMN \`attemptCount\``);
    }
    if (await queryRunner.hasTable('sms_messages')) await queryRunner.query('DROP TABLE `sms_messages`');
  }
}
