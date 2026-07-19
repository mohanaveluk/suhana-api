import { MigrationInterface, QueryRunner } from 'typeorm';

// Creates the login_otc_tokens table backing the passwordless (email) login flow.
// Column names match the LoginOtc entity property names exactly (no @Column name
// overrides there), so TypeORM maps to them without a naming strategy transform.
export class CreateLoginOtcTokens1784332800000 implements MigrationInterface {
  name = 'CreateLoginOtcTokens1784332800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`login_otc_tokens\` (
        \`id\` varchar(36) NOT NULL,
        \`email\` varchar(255) NOT NULL,
        \`codeHash\` varchar(255) NOT NULL,
        \`expiresAt\` timestamp NOT NULL,
        \`used\` tinyint NOT NULL DEFAULT 0,
        \`createdAt\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await queryRunner.query(`
      CREATE INDEX \`IDX_login_otc_tokens_email\`
      ON \`login_otc_tokens\` (\`email\`)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX \`IDX_login_otc_tokens_email\` ON \`login_otc_tokens\``);
    await queryRunner.query(`DROP TABLE \`login_otc_tokens\``);
  }
}
