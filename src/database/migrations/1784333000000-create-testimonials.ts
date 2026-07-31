import { MigrationInterface, QueryRunner } from 'typeorm';

// Trust & Testimonials schema: reviews, replies, likes, reports, success stories.
// Column names match the entities exactly; indexes back the public/admin queries.
export class CreateTestimonials1784333000000 implements MigrationInterface {
  name = 'CreateTestimonials1784333000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ── user_review ──────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`user_review\` (
        \`id\` varchar(36) NOT NULL,
        \`user_id\` varchar(36) NOT NULL,
        \`profile_id\` varchar(36) NULL,
        \`review_type\` enum('GENERAL','MATCHMAKING','MEMBERSHIP','CUSTOMER_SUPPORT','SUCCESS_STORY') NOT NULL DEFAULT 'GENERAL',
        \`title\` varchar(255) NOT NULL,
        \`review_text\` text NOT NULL,
        \`overall_rating\` tinyint UNSIGNED NOT NULL,
        \`ease_of_use_rating\` tinyint UNSIGNED NULL,
        \`match_quality_rating\` tinyint UNSIGNED NULL,
        \`communication_rating\` tinyint UNSIGNED NULL,
        \`customer_support_rating\` tinyint UNSIGNED NULL,
        \`trust_safety_rating\` tinyint UNSIGNED NULL,
        \`sentiment\` enum('POSITIVE','NEUTRAL','NEGATIVE') NULL,
        \`is_verified_review\` tinyint NOT NULL DEFAULT 0,
        \`status\` enum('PENDING','APPROVED','REJECTED','HIDDEN') NOT NULL DEFAULT 'PENDING',
        \`is_featured\` tinyint NOT NULL DEFAULT 0,
        \`featured_order\` int NULL,
        \`like_count\` int NOT NULL DEFAULT 0,
        \`reply_count\` int NOT NULL DEFAULT 0,
        \`report_count\` int NOT NULL DEFAULT 0,
        \`view_count\` int NOT NULL DEFAULT 0,
        \`admin_notes\` text NULL,
        \`approved_by\` varchar(36) NULL,
        \`approved_at\` datetime NULL,
        \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        \`deleted_at\` datetime(6) NULL,
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    await queryRunner.query(`CREATE INDEX \`IDX_review_user_id\` ON \`user_review\` (\`user_id\`)`);
    await queryRunner.query(`CREATE INDEX \`IDX_review_status\` ON \`user_review\` (\`status\`)`);
    await queryRunner.query(`CREATE INDEX \`IDX_review_is_featured\` ON \`user_review\` (\`is_featured\`)`);
    await queryRunner.query(`CREATE INDEX \`IDX_review_status_featured\` ON \`user_review\` (\`status\`, \`is_featured\`)`);
    await queryRunner.query(`CREATE INDEX \`IDX_review_status_created\` ON \`user_review\` (\`status\`, \`created_at\`)`);

    // ── review_reply ───────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`review_reply\` (
        \`id\` varchar(36) NOT NULL,
        \`review_id\` varchar(36) NOT NULL,
        \`parent_reply_id\` varchar(36) NULL,
        \`user_id\` varchar(36) NULL,
        \`admin_id\` varchar(36) NULL,
        \`reply_text\` varchar(2000) NOT NULL,
        \`status\` enum('PENDING','APPROVED','REJECTED') NOT NULL DEFAULT 'APPROVED',
        \`like_count\` int NOT NULL DEFAULT 0,
        \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        \`deleted_at\` datetime(6) NULL,
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    await queryRunner.query(`CREATE INDEX \`IDX_reply_review_id\` ON \`review_reply\` (\`review_id\`)`);
    await queryRunner.query(`CREATE INDEX \`IDX_reply_parent_id\` ON \`review_reply\` (\`parent_reply_id\`)`);

    // ── review_like ────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`review_like\` (
        \`id\` varchar(36) NOT NULL,
        \`review_id\` varchar(36) NOT NULL,
        \`user_id\` varchar(36) NOT NULL,
        \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`UQ_review_like_review_user\` (\`review_id\`, \`user_id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    await queryRunner.query(`CREATE INDEX \`IDX_like_review_id\` ON \`review_like\` (\`review_id\`)`);

    // ── review_report ──────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`review_report\` (
        \`id\` varchar(36) NOT NULL,
        \`review_id\` varchar(36) NOT NULL,
        \`reported_by_user_id\` varchar(36) NOT NULL,
        \`reason\` enum('SPAM','ABUSE','FAKE_REVIEW','OFFENSIVE_LANGUAGE','OTHER') NOT NULL,
        \`comments\` varchar(1000) NULL,
        \`status\` enum('OPEN','UNDER_REVIEW','RESOLVED','DISMISSED') NOT NULL DEFAULT 'OPEN',
        \`reviewed_by\` varchar(36) NULL,
        \`reviewed_at\` datetime NULL,
        \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    await queryRunner.query(`CREATE INDEX \`IDX_report_review_id\` ON \`review_report\` (\`review_id\`)`);
    await queryRunner.query(`CREATE INDEX \`IDX_report_reporter\` ON \`review_report\` (\`reported_by_user_id\`)`);
    await queryRunner.query(`CREATE INDEX \`IDX_report_status\` ON \`review_report\` (\`status\`)`);

    // ── success_story ──────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`success_story\` (
        \`id\` varchar(36) NOT NULL,
        \`groom_profile_id\` varchar(36) NULL,
        \`bride_profile_id\` varchar(36) NULL,
        \`groom_name\` varchar(150) NOT NULL,
        \`bride_name\` varchar(150) NOT NULL,
        \`title\` varchar(255) NOT NULL,
        \`story\` text NOT NULL,
        \`engagement_date\` date NULL,
        \`marriage_date\` date NULL,
        \`photo_url\` varchar(1000) NULL,
        \`gallery_urls\` json NULL,
        \`location\` varchar(255) NULL,
        \`is_featured\` tinyint NOT NULL DEFAULT 0,
        \`status\` enum('PENDING','APPROVED','REJECTED') NOT NULL DEFAULT 'PENDING',
        \`wedding_photo_url\` varchar(1000) NULL,
        \`wedding_invitation_url\` varchar(1000) NULL,
        \`marriage_certificate_url\` varchar(1000) NULL,
        \`marriage_verification_status\` enum('PENDING','VERIFIED','REJECTED') NOT NULL DEFAULT 'PENDING',
        \`verified_marriage\` tinyint NOT NULL DEFAULT 0,
        \`verified_by\` varchar(36) NULL,
        \`verified_at\` datetime NULL,
        \`created_by\` varchar(36) NOT NULL,
        \`approved_by\` varchar(36) NULL,
        \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        \`deleted_at\` datetime(6) NULL,
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    await queryRunner.query(`CREATE INDEX \`IDX_story_status\` ON \`success_story\` (\`status\`)`);
    await queryRunner.query(`CREATE INDEX \`IDX_story_is_featured\` ON \`success_story\` (\`is_featured\`)`);
    await queryRunner.query(`CREATE INDEX \`IDX_story_status_featured\` ON \`success_story\` (\`status\`, \`is_featured\`)`);
    await queryRunner.query(`CREATE INDEX \`IDX_story_marriage_verification\` ON \`success_story\` (\`marriage_verification_status\`)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE \`review_report\``);
    await queryRunner.query(`DROP TABLE \`review_like\``);
    await queryRunner.query(`DROP TABLE \`review_reply\``);
    await queryRunner.query(`DROP TABLE \`success_story\``);
    await queryRunner.query(`DROP TABLE \`user_review\``);
  }
}
