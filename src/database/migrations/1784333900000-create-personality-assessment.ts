import { MigrationInterface, QueryRunner } from 'typeorm';

// Aurora Personality Assessment.
//
//   personality_questions          32 statements, 8 per dimension (EI/SN/TF/JP)
//   personality_question_options   5 Likert choices per question + score mapping
//   personality_assessments        one row per attempt; latest COMPLETED = current result
//   personality_responses          chosen option per question per attempt
//
// Index/FK names match the entity decorators so dev `synchronize` and this
// migration produce the same schema. No FK to `profiles` — its collation
// predates this table (same approach as profile_visits).
export class CreatePersonalityAssessment1784333900000
  implements MigrationInterface
{
  name = 'CreatePersonalityAssessment1784333900000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`personality_questions\` (
        \`id\`            int                         NOT NULL AUTO_INCREMENT,
        \`question_code\` varchar(20)                 NOT NULL,
        \`question_text\` varchar(500)                NOT NULL,
        \`dimension\`     enum('EI','SN','TF','JP')   NOT NULL,
        \`translations\`  json                        NULL,
        \`active_flag\`   tinyint                     NOT NULL DEFAULT 1,
        \`display_order\` int                         NOT NULL,
        \`created_at\`    datetime(6)                 NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updated_at\`    datetime(6)                 NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`UQ_PERSONALITY_QUESTIONS_CODE\` (\`question_code\`),
        KEY \`IDX_PERSONALITY_QUESTIONS_ACTIVE_ORDER\` (\`active_flag\`, \`display_order\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`personality_question_options\` (
        \`id\`              int                                       NOT NULL AUTO_INCREMENT,
        \`question_id\`     int                                       NOT NULL,
        \`option_key\`      varchar(30)                               NOT NULL,
        \`option_text\`     varchar(100)                              NOT NULL,
        \`score_direction\` enum('E','I','S','N','T','F','J','P')     NOT NULL,
        \`score_value\`     tinyint unsigned                          NOT NULL,
        \`display_order\`   tinyint unsigned                          NOT NULL,
        \`translations\`    json                                      NULL,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`UQ_PERSONALITY_OPTIONS_QUESTION_KEY\` (\`question_id\`, \`option_key\`),
        CONSTRAINT \`FK_PERSONALITY_OPTIONS_QUESTION\` FOREIGN KEY (\`question_id\`)
          REFERENCES \`personality_questions\` (\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`personality_assessments\` (
        \`id\`                 varchar(36)                         NOT NULL,
        \`profile_id\`         varchar(36)                         NOT NULL,
        \`status\`             enum('IN_PROGRESS','COMPLETED')     NOT NULL DEFAULT 'IN_PROGRESS',
        \`completed_date\`     datetime                            NULL,
        \`personality_type\`   char(4)                             NULL,
        \`confidence_score\`   decimal(5,2)                        NULL,
        \`introversion_score\` smallint unsigned                   NOT NULL DEFAULT 0,
        \`extroversion_score\` smallint unsigned                   NOT NULL DEFAULT 0,
        \`sensing_score\`      smallint unsigned                   NOT NULL DEFAULT 0,
        \`intuition_score\`    smallint unsigned                   NOT NULL DEFAULT 0,
        \`thinking_score\`     smallint unsigned                   NOT NULL DEFAULT 0,
        \`feeling_score\`      smallint unsigned                   NOT NULL DEFAULT 0,
        \`judging_score\`      smallint unsigned                   NOT NULL DEFAULT 0,
        \`perceiving_score\`   smallint unsigned                   NOT NULL DEFAULT 0,
        \`created_at\`         datetime(6)                         NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updated_at\`         datetime(6)                         NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        KEY \`IDX_PERSONALITY_ASSESSMENTS_PROFILE_STATUS\` (\`profile_id\`, \`status\`, \`completed_date\`),
        KEY \`IDX_PERSONALITY_ASSESSMENTS_TYPE\` (\`personality_type\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`personality_responses\` (
        \`id\`                 varchar(36)  NOT NULL,
        \`assessment_id\`      varchar(36)  NOT NULL,
        \`question_id\`        int          NOT NULL,
        \`selected_option_id\` int          NOT NULL,
        \`created_at\`         datetime(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`UQ_PERSONALITY_RESPONSES_ASSESSMENT_QUESTION\` (\`assessment_id\`, \`question_id\`),
        CONSTRAINT \`FK_PERSONALITY_RESPONSES_ASSESSMENT\` FOREIGN KEY (\`assessment_id\`)
          REFERENCES \`personality_assessments\` (\`id\`) ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT \`FK_PERSONALITY_RESPONSES_QUESTION\` FOREIGN KEY (\`question_id\`)
          REFERENCES \`personality_questions\` (\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION,
        CONSTRAINT \`FK_PERSONALITY_RESPONSES_OPTION\` FOREIGN KEY (\`selected_option_id\`)
          REFERENCES \`personality_question_options\` (\`id\`) ON DELETE RESTRICT ON UPDATE NO ACTION
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS \`personality_responses\``);
    await queryRunner.query(`DROP TABLE IF EXISTS \`personality_assessments\``);
    await queryRunner.query(
      `DROP TABLE IF EXISTS \`personality_question_options\``,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS \`personality_questions\``);
  }
}
