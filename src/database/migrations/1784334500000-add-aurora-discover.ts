import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Aurora Discover (local marriage-services directory), Phase 1.
 *
 * Shared, category-driven tables + the astrologer detail table + the
 * geo_postal_codes lookup used for ZIP/PIN/city geocoding (filled by
 * scripts/import-geonames-postal-codes.js — NOT by this migration).
 *
 * Seeds the category list only: astrologer active, the rest inactive
 * ("coming soon"). No provider records are seeded here.
 *
 * No DB-level foreign keys (same approach as personality / profile_visits):
 * integrity is enforced in the service layer. Idempotent: every CREATE is
 * IF NOT EXISTS and the seed uses INSERT IGNORE on the unique slug, so it is
 * safe after dev `synchronize` has already created the tables.
 * Must stay in step with src/modules/discovery/entities/*.entity.ts.
 */
export class AddAuroraDiscover1784334500000 implements MigrationInterface {
  name = 'AddAuroraDiscover1784334500000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`discovery_categories\` (
        \`id\` int NOT NULL AUTO_INCREMENT,
        \`slug\` varchar(64) NOT NULL,
        \`name\` varchar(100) NOT NULL,
        \`description\` varchar(500) NULL,
        \`parent_id\` int NULL,
        \`kind\` varchar(16) NOT NULL DEFAULT 'SERVICE',
        \`icon\` varchar(64) NULL,
        \`image_url\` varchar(255) NULL,
        \`is_active\` tinyint NOT NULL DEFAULT 0,
        \`display_order\` int NOT NULL DEFAULT 0,
        \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        UNIQUE INDEX \`IDX_DISCOVERY_CATEGORIES_SLUG\` (\`slug\`),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`discovery_providers\` (
        \`id\` varchar(36) NOT NULL,
        \`user_id\` varchar(36) NULL,
        \`display_name\` varchar(150) NOT NULL,
        \`business_name\` varchar(150) NULL,
        \`headline\` varchar(200) NULL,
        \`about\` text NULL,
        \`photo_url\` varchar(500) NULL,
        \`email\` varchar(255) NULL,
        \`phone\` varchar(32) NULL,
        \`website\` varchar(500) NULL,
        \`verification_status\` varchar(16) NOT NULL DEFAULT 'PENDING',
        \`verification_notes\` varchar(500) NULL,
        \`verified_at\` datetime NULL,
        \`verified_by\` varchar(36) NULL,
        \`is_active\` tinyint NOT NULL DEFAULT 1,
        \`accepting_clients\` tinyint NOT NULL DEFAULT 1,
        \`rating_avg\` decimal(3,2) NULL,
        \`rating_count\` int NOT NULL DEFAULT 0,
        \`created_by\` varchar(36) NULL,
        \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        \`deleted_at\` datetime(6) NULL,
        INDEX \`IDX_DISCOVERY_PROVIDERS_VISIBILITY\` (\`is_active\`, \`verification_status\`, \`deleted_at\`),
        INDEX \`IDX_DISCOVERY_PROVIDERS_USER\` (\`user_id\`),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`discovery_provider_categories\` (
        \`provider_id\` varchar(36) NOT NULL,
        \`category_id\` int NOT NULL,
        \`is_primary\` tinyint NOT NULL DEFAULT 0,
        INDEX \`IDX_DISCOVERY_PROVIDER_CATEGORIES_CATEGORY\` (\`category_id\`, \`provider_id\`),
        PRIMARY KEY (\`provider_id\`, \`category_id\`)
      ) ENGINE=InnoDB`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`discovery_locations\` (
        \`id\` varchar(36) NOT NULL,
        \`provider_id\` varchar(36) NOT NULL,
        \`label\` varchar(100) NULL,
        \`address_line1\` varchar(255) NULL,
        \`address_line2\` varchar(255) NULL,
        \`city\` varchar(100) NOT NULL,
        \`state\` varchar(100) NULL,
        \`postal_code\` varchar(12) NULL,
        \`country\` varchar(2) NOT NULL,
        \`latitude\` decimal(9,6) NULL,
        \`longitude\` decimal(9,6) NULL,
        \`show_street_address\` tinyint NOT NULL DEFAULT 1,
        \`is_primary\` tinyint NOT NULL DEFAULT 0,
        \`is_active\` tinyint NOT NULL DEFAULT 1,
        \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        INDEX \`IDX_DISCOVERY_LOCATIONS_GEO\` (\`latitude\`, \`longitude\`),
        INDEX \`IDX_DISCOVERY_LOCATIONS_PLACE\` (\`country\`, \`state\`, \`city\`),
        INDEX \`IDX_DISCOVERY_LOCATIONS_PROVIDER\` (\`provider_id\`),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`discovery_services\` (
        \`id\` varchar(36) NOT NULL,
        \`provider_id\` varchar(36) NOT NULL,
        \`category_id\` int NOT NULL,
        \`name\` varchar(150) NOT NULL,
        \`specialization\` varchar(64) NULL,
        \`consultation_mode\` varchar(16) NOT NULL,
        \`price\` decimal(10,2) NULL,
        \`currency\` varchar(3) NULL,
        \`duration_minutes\` int NULL,
        \`description\` varchar(500) NULL,
        \`is_active\` tinyint NOT NULL DEFAULT 1,
        \`display_order\` int NOT NULL DEFAULT 0,
        \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        INDEX \`IDX_DISCOVERY_SERVICES_PROVIDER\` (\`provider_id\`, \`is_active\`),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`discovery_provider_languages\` (
        \`provider_id\` varchar(36) NOT NULL,
        \`language_code\` varchar(8) NOT NULL,
        INDEX \`IDX_DISCOVERY_PROVIDER_LANGUAGES_CODE\` (\`language_code\`),
        PRIMARY KEY (\`provider_id\`, \`language_code\`)
      ) ENGINE=InnoDB`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`discovery_provider_media\` (
        \`id\` varchar(36) NOT NULL,
        \`provider_id\` varchar(36) NOT NULL,
        \`url\` varchar(500) NOT NULL,
        \`caption\` varchar(200) NULL,
        \`display_order\` int NOT NULL DEFAULT 0,
        \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        INDEX \`IDX_DISCOVERY_PROVIDER_MEDIA_PROVIDER\` (\`provider_id\`, \`display_order\`),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`discovery_astrologer_details\` (
        \`provider_id\` varchar(36) NOT NULL,
        \`experience_years\` int NULL,
        \`specializations\` json NULL,
        \`business_hours\` json NULL,
        \`certifications\` json NULL,
        \`availability_note\` varchar(255) NULL,
        \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        INDEX \`IDX_DISCOVERY_ASTROLOGER_DETAILS_EXPERIENCE\` (\`experience_years\`),
        PRIMARY KEY (\`provider_id\`)
      ) ENGINE=InnoDB`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`discovery_favorites\` (
        \`id\` varchar(36) NOT NULL,
        \`user_id\` varchar(36) NOT NULL,
        \`provider_id\` varchar(36) NOT NULL,
        \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        UNIQUE INDEX \`IDX_DISCOVERY_FAVORITES_USER_PROVIDER\` (\`user_id\`, \`provider_id\`),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`discovery_reviews\` (
        \`id\` varchar(36) NOT NULL,
        \`provider_id\` varchar(36) NOT NULL,
        \`user_id\` varchar(36) NOT NULL,
        \`rating\` tinyint NOT NULL,
        \`title\` varchar(150) NULL,
        \`comment\` text NOT NULL,
        \`status\` varchar(16) NOT NULL DEFAULT 'PENDING',
        \`moderation_note\` varchar(500) NULL,
        \`moderated_by\` varchar(36) NULL,
        \`moderated_at\` datetime NULL,
        \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        UNIQUE INDEX \`IDX_DISCOVERY_REVIEWS_PROVIDER_USER\` (\`provider_id\`, \`user_id\`),
        INDEX \`IDX_DISCOVERY_REVIEWS_STATUS\` (\`status\`, \`created_at\`),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`geo_postal_codes\` (
        \`id\` int NOT NULL AUTO_INCREMENT,
        \`country_code\` varchar(2) NOT NULL,
        \`postal_code\` varchar(20) NOT NULL,
        \`place_name\` varchar(180) NOT NULL,
        \`admin_name1\` varchar(100) NULL,
        \`admin_code1\` varchar(20) NULL,
        \`admin_name2\` varchar(100) NULL,
        \`latitude\` decimal(9,6) NOT NULL,
        \`longitude\` decimal(9,6) NOT NULL,
        INDEX \`IDX_GEO_POSTAL_CODES_LOOKUP\` (\`country_code\`, \`postal_code\`),
        INDEX \`IDX_GEO_POSTAL_CODES_PLACE\` (\`country_code\`, \`place_name\`),
        INDEX \`IDX_GEO_POSTAL_CODES_ADMIN1\` (\`country_code\`, \`admin_name1\`),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB`);

    // Category catalogue. Only astrologers are live in Phase 1; the rest render as "Coming soon".
    // Image paths are served by the Angular app from public/discover/.
    await queryRunner.query(`
      INSERT IGNORE INTO \`discovery_categories\`
        (\`slug\`, \`name\`, \`description\`, \`kind\`, \`icon\`, \`image_url\`, \`is_active\`, \`display_order\`)
      VALUES
        ('astrologer', 'Astrologers', 'Kundli reading, horoscope matching, dosha and muhurtham consultations.', 'SERVICE', 'auto_awesome', '/discover/astrologer.webp', 1, 10),
        ('marriage-hall', 'Marriage Halls', 'Wedding venues and banquet halls.', 'SERVICE', 'account_balance', '/discover/marriage-hall.webp', 0, 20),
        ('wedding-planner', 'Wedding Planners', 'Planning and coordination for the whole celebration.', 'SERVICE', 'event_available', '/discover/wedding-planner.webp', 0, 30),
        ('matrimonial-consultant', 'Matrimonial Consultants', 'Experienced consultants who help families find a match.', 'SERVICE', 'diversity_3', NULL, 0, 40),
        ('photography', 'Photography', 'Wedding photographers and videographers.', 'SERVICE', 'photo_camera', '/discover/photography.webp', 0, 50),
        ('catering-decoration', 'Catering & Decoration', 'Caterers, decorators and event services.', 'SERVICE', 'restaurant', '/discover/catering.webp', 0, 60),
        ('wedding-shopping', 'Wedding Shopping', 'Jewellery, attire and wedding essentials.', 'PRODUCT', 'shopping_bag', '/discover/wedding-shopping.webp', 0, 70),
        ('mehndi-artist', 'Mehndi Artists', 'Bridal mehndi, party mehndi, henna tattoos and mehndi classes.', 'SERVICE', 'brush', '/discover/mehndi-artist.webp', 0, 80)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const t of [
      'geo_postal_codes',
      'discovery_reviews',
      'discovery_favorites',
      'discovery_astrologer_details',
      'discovery_provider_media',
      'discovery_provider_languages',
      'discovery_services',
      'discovery_locations',
      'discovery_provider_categories',
      'discovery_providers',
      'discovery_categories',
    ]) {
      await queryRunner.query(`DROP TABLE IF EXISTS \`${t}\``);
    }
  }
}
