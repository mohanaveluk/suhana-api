import { MigrationInterface, QueryRunner } from 'typeorm';

// Creates the audit_log table plus the indexes backing the module's hot paths:
// per-user history/timeline, admin filtering, and risk-level reporting.
// Column names match the AuditLog entity exactly.
export class CreateAuditLog1784332900000 implements MigrationInterface {
  name = 'CreateAuditLog1784332900000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`audit_log\` (
        \`id\` varchar(36) NOT NULL,
        \`user_id\` varchar(36) NULL,
        \`profile_id\` varchar(36) NULL,
        \`event_type\` varchar(60) NOT NULL,
        \`entity_type\` varchar(40) NULL,
        \`entity_id\` varchar(64) NULL,
        \`old_value\` json NULL,
        \`new_value\` json NULL,
        \`changed_fields\` json NULL,
        \`description\` varchar(500) NULL,
        \`ip_address\` varchar(45) NULL,
        \`user_agent\` varchar(512) NULL,
        \`device_type\` varchar(20) NULL,
        \`platform\` varchar(40) NULL,
        \`country\` varchar(80) NULL,
        \`state\` varchar(80) NULL,
        \`city\` varchar(80) NULL,
        \`risk_score\` int NOT NULL DEFAULT 0,
        \`risk_level\` varchar(10) NOT NULL DEFAULT 'LOW',
        \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
        PRIMARY KEY (\`id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    // Single-column indexes (explicitly requested)
    await queryRunner.query(`CREATE INDEX \`IDX_audit_user_id\` ON \`audit_log\` (\`user_id\`)`);
    await queryRunner.query(`CREATE INDEX \`IDX_audit_event_type\` ON \`audit_log\` (\`event_type\`)`);
    await queryRunner.query(`CREATE INDEX \`IDX_audit_entity_type\` ON \`audit_log\` (\`entity_type\`)`);
    await queryRunner.query(`CREATE INDEX \`IDX_audit_risk_level\` ON \`audit_log\` (\`risk_level\`)`);
    await queryRunner.query(`CREATE INDEX \`IDX_audit_created_at\` ON \`audit_log\` (\`created_at\`)`);

    // Composite indexes for the actual query shapes
    await queryRunner.query(`CREATE INDEX \`IDX_audit_user_created\` ON \`audit_log\` (\`user_id\`, \`created_at\`)`);
    await queryRunner.query(`CREATE INDEX \`IDX_audit_user_event\` ON \`audit_log\` (\`user_id\`, \`event_type\`)`);
    await queryRunner.query(`CREATE INDEX \`IDX_audit_event_created\` ON \`audit_log\` (\`event_type\`, \`created_at\`)`);
    await queryRunner.query(`CREATE INDEX \`IDX_audit_risk_created\` ON \`audit_log\` (\`risk_level\`, \`created_at\`)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE \`audit_log\``);
  }
}
