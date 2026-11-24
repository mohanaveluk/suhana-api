import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Aurora Discover: per-category details for every category except astrologers
 * (marriage halls, wedding planners, matrimonial consultants, photography,
 * catering & decoration, wedding shopping). `attributes` is a typed JSON object
 * validated by CATEGORY_DEFINITIONS in the API. Idempotent; no FKs (module convention).
 * Must stay in step with entities/discovery-service-detail.entity.ts.
 */
export class AddDiscoveryServiceDetails1784334600000 implements MigrationInterface {
  name = 'AddDiscoveryServiceDetails1784334600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`discovery_service_details\` (
        \`provider_id\` varchar(36) NOT NULL,
        \`category_id\` int NOT NULL,
        \`experience_years\` int NULL,
        \`specialties\` json NULL,
        \`attributes\` json NULL,
        \`business_hours\` json NULL,
        \`certifications\` json NULL,
        \`availability_note\` varchar(255) NULL,
        \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
        INDEX \`IDX_DISCOVERY_SERVICE_DETAILS_CATEGORY\` (\`category_id\`, \`experience_years\`),
        PRIMARY KEY (\`provider_id\`, \`category_id\`)
      ) ENGINE=InnoDB`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS `discovery_service_details`');
  }
}
