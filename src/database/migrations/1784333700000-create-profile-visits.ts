import { MigrationInterface, QueryRunner } from 'typeorm';

// Recently Visited Profiles.
//
// One row per (visitor, visited profile). A repeat view updates visit_count and
// last_visited_at in place — the unique key (visitor_user_id, visited_profile_id)
// is what enforces that — so the table stays small and the "recently visited"
// list is a single indexed range scan.
//
// Removal from the list is a soft delete (is_deleted); a later re-visit revives
// the row and resumes its counter.
export class CreateProfileVisits1784333700000 implements MigrationInterface {
  name = 'CreateProfileVisits1784333700000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`profile_visits\` (
        \`id\`                 varchar(36)  NOT NULL,
        \`visitor_user_id\`    varchar(36)  NOT NULL,
        \`visited_profile_id\` varchar(36)  NOT NULL,
        \`visited_user_id\`    varchar(36)  NOT NULL,
        \`visit_count\`        int unsigned NOT NULL DEFAULT 1,
        \`first_visited_at\`   datetime     NOT NULL,
        \`last_visited_at\`    datetime     NOT NULL,
        \`is_deleted\`         tinyint      NOT NULL DEFAULT 0,
        \`deleted_at\`         datetime     NULL,
        \`created_at\`         datetime(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updated_at\`         datetime(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`UQ_PROFILE_VISITS_VISITOR_PROFILE\` (\`visitor_user_id\`, \`visited_profile_id\`),
        KEY \`IDX_PROFILE_VISITS_VISITOR\` (\`visitor_user_id\`),
        KEY \`IDX_PROFILE_VISITS_VISITED_PROFILE\` (\`visited_profile_id\`),
        KEY \`IDX_PROFILE_VISITS_VISITOR_RECENT\` (\`visitor_user_id\`, \`is_deleted\`, \`last_visited_at\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS \`profile_visits\``);
  }
}
