import { MigrationInterface, QueryRunner } from 'typeorm';

// Adds profiles.marital_status.
//
// The AI search parser already extracts marital status from queries such as
// "find a divorced groom", but there was no column to filter on, so the intent
// was silently dropped. This closes that gap.
//
// Left NULL for existing rows on purpose: defaulting them to 'Never Married'
// would assert a fact about real members that we do not have. Collect the field
// in the profile form and backfill deliberately. Until then, search treats NULL
// as "unknown" and admits it only for 'Never Married' queries.
export class AddProfileMaritalStatus1784333600000 implements MigrationInterface {
  name = 'AddProfileMaritalStatus1784333600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('profiles'))) return;

    const ENUM = `enum('Never Married','Awaiting Divorce','Divorced','Widowed','Annulled')`;

    if (!(await queryRunner.hasColumn('profiles', 'marital_status'))) {
      await queryRunner.query(
        `ALTER TABLE \`profiles\` ADD \`marital_status\` ${ENUM} NULL`,
      );
      await queryRunner.query(
        `CREATE INDEX \`IDX_PROFILES_MARITAL_STATUS\` ON \`profiles\` (\`marital_status\`)`,
      );
    } else {
      // Idempotent widening: if an earlier run of this migration created the
      // column with a narrower value list, bring it up to date rather than
      // leaving the schema out of step with the entity. MODIFY is safe here
      // because the new list is a superset of the old one.
      await queryRunner.query(
        `ALTER TABLE \`profiles\` MODIFY \`marital_status\` ${ENUM} NULL`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('profiles'))) return;

    if (await queryRunner.hasColumn('profiles', 'marital_status')) {
      const [index] = await queryRunner.query(
        `SHOW INDEX FROM \`profiles\` WHERE Key_name = 'IDX_PROFILES_MARITAL_STATUS'`,
      );
      if (index) {
        await queryRunner.query(
          `DROP INDEX \`IDX_PROFILES_MARITAL_STATUS\` ON \`profiles\``,
        );
      }
      await queryRunner.query(`ALTER TABLE \`profiles\` DROP COLUMN \`marital_status\``);
    }
  }
}
