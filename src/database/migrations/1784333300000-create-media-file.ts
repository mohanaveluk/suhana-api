import { MigrationInterface, QueryRunner } from 'typeorm';

// Upload history for non-image media (voice introductions first).
// Column names match MediaFile exactly. Indexes back the "my uploads for this
// context" lookups and the admin/context reporting queries.
export class CreateMediaFile1784333300000 implements MigrationInterface {
  name = 'CreateMediaFile1784333300000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`media_file\` (
        \`id\` varchar(36) NOT NULL,
        \`guid\` varchar(36) NOT NULL,
        \`user_id\` varchar(36) NOT NULL,
        \`profile_id\` varchar(36) NULL,
        \`context\` varchar(40) NOT NULL,
        \`file_name\` varchar(255) NOT NULL,
        \`original_file_name\` varchar(255) NULL,
        \`mime_type\` varchar(100) NULL,
        \`file_extension\` varchar(20) NULL,
        \`file_size\` int UNSIGNED NULL,
        \`duration_seconds\` int UNSIGNED NULL,
        \`storage_provider\` varchar(20) NOT NULL DEFAULT 'GCS',
        \`bucket_name\` varchar(255) NULL,
        \`folder_path\` varchar(500) NULL,
        \`public_url\` text NOT NULL,
        \`is_deleted\` tinyint NOT NULL DEFAULT 0,
        \`deleted_at\` datetime NULL,
        \`created_by\` varchar(36) NULL,
        \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        KEY \`IDX_MEDIA_USER_CONTEXT\` (\`user_id\`, \`context\`),
        KEY \`IDX_MEDIA_PROFILE_CONTEXT\` (\`profile_id\`, \`context\`),
        KEY \`IDX_MEDIA_CONTEXT_CREATED\` (\`context\`, \`created_at\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS \`media_file\``);
  }
}
