import { MigrationInterface, QueryRunner } from 'typeorm';

// AI search analytics and saved searches.
//
// search_history is append-only and indexed for the two read patterns that
// matter: a member's recent searches (user_id, created_at) and platform-wide
// popular searches (normalised_query).
export class CreateSearchTables1784333500000 implements MigrationInterface {
  name = 'CreateSearchTables1784333500000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`search_history\` (
        \`id\` varchar(36) NOT NULL,
        \`user_id\` varchar(36) NULL,
        \`query\` varchar(500) NOT NULL,
        \`normalised_query\` varchar(500) NOT NULL,
        \`parsed_intent\` json NULL,
        \`confidence\` int NOT NULL DEFAULT 0,
        \`intent_source\` varchar(20) NOT NULL DEFAULT 'LOCAL',
        \`result_count\` int NOT NULL DEFAULT 0,
        \`search_time_ms\` int NOT NULL DEFAULT 0,
        \`ip_address\` varchar(64) NULL,
        \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        KEY \`IDX_SEARCH_HIST_USER_CREATED\` (\`user_id\`, \`created_at\`),
        KEY \`IDX_SEARCH_HIST_CREATED\` (\`created_at\`),
        KEY \`IDX_SEARCH_HIST_NORMALISED\` (\`normalised_query\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`saved_search\` (
        \`id\` varchar(36) NOT NULL,
        \`guid\` varchar(36) NOT NULL,
        \`user_id\` varchar(36) NOT NULL,
        \`name\` varchar(200) NOT NULL,
        \`query\` varchar(500) NOT NULL,
        \`parsed_intent\` json NULL,
        \`result_count_at_save\` int NOT NULL DEFAULT 0,
        \`last_run_at\` datetime NULL,
        \`is_deleted\` tinyint NOT NULL DEFAULT 0,
        \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        KEY \`IDX_SAVED_SEARCH_USER\` (\`user_id\`, \`is_deleted\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS \`saved_search\``);
    await queryRunner.query(`DROP TABLE IF EXISTS \`search_history\``);
  }
}
