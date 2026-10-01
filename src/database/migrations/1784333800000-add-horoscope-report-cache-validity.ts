import { MigrationInterface, QueryRunner } from 'typeorm';

// Adds horoscope_compatibility_reports.is_active / invalidated_at.
//
// A cached AI horoscope compatibility report is keyed on DOB/time/place of
// birth, which do not change when a member simply replaces their uploaded
// horoscope document — so the cache kept serving a report generated from the
// old document. These columns let MatchesService invalidate every report
// involving a member (rather than deleting it) the moment their
// horoscopeDocUrl changes, forcing a fresh AI evaluation on the next request.
export class AddHoroscopeReportCacheValidity1784333800000 implements MigrationInterface {
  name = 'AddHoroscopeReportCacheValidity1784333800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('horoscope_compatibility_reports'))) return;

    if (!(await queryRunner.hasColumn('horoscope_compatibility_reports', 'is_active'))) {
      await queryRunner.query(
        `ALTER TABLE \`horoscope_compatibility_reports\` ADD \`is_active\` tinyint NOT NULL DEFAULT 1`,
      );
    }

    if (!(await queryRunner.hasColumn('horoscope_compatibility_reports', 'invalidated_at'))) {
      await queryRunner.query(
        `ALTER TABLE \`horoscope_compatibility_reports\` ADD \`invalidated_at\` datetime NULL`,
      );
    }

    await queryRunner.query(
      `CREATE INDEX \`IDX_HOROSCOPE_REPORTS_USER_ONE_ACTIVE\` ON \`horoscope_compatibility_reports\` (\`userOneId\`, \`is_active\`)`,
    );
    await queryRunner.query(
      `CREATE INDEX \`IDX_HOROSCOPE_REPORTS_USER_TWO_ACTIVE\` ON \`horoscope_compatibility_reports\` (\`userTwoId\`, \`is_active\`)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('horoscope_compatibility_reports'))) return;

    for (const index of ['IDX_HOROSCOPE_REPORTS_USER_ONE_ACTIVE', 'IDX_HOROSCOPE_REPORTS_USER_TWO_ACTIVE']) {
      const [found] = await queryRunner.query(
        `SHOW INDEX FROM \`horoscope_compatibility_reports\` WHERE Key_name = '${index}'`,
      );
      if (found) {
        await queryRunner.query(`DROP INDEX \`${index}\` ON \`horoscope_compatibility_reports\``);
      }
    }

    if (await queryRunner.hasColumn('horoscope_compatibility_reports', 'invalidated_at')) {
      await queryRunner.query(`ALTER TABLE \`horoscope_compatibility_reports\` DROP COLUMN \`invalidated_at\``);
    }
    if (await queryRunner.hasColumn('horoscope_compatibility_reports', 'is_active')) {
      await queryRunner.query(`ALTER TABLE \`horoscope_compatibility_reports\` DROP COLUMN \`is_active\``);
    }
  }
}
