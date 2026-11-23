import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * "My Interests" dashboard — extends the existing `interests` table instead of adding a parallel
 * interactions table (profile views and messages already live in `profile_visits` / `messages`).
 *
 *  - status:      adds 'withdrawn' (sender retracted a pending interest; the row is kept as history)
 *  - isRead:      recipient has opened the interest ("New" vs "Viewed")
 *  - readAt / respondedAt / withdrawnAt: lifecycle timestamps
 *  - source:      where the sender found the profile (PROFILE_SEARCH, AI_MATCH, …) for reporting
 *  - updatedAt:   last status change, for "Recently updated" sorting
 *  - indexes:     the dashboard reads by recipient / sender, newest first
 *
 * Existing rows: anything already answered is marked read, and respondedAt is back-filled from
 * acceptedOn. Idempotent (safe to re-run), like the other migrations in this folder.
 */
export class ExtendInterestsForMyInterests1784334200000 implements MigrationInterface {
  name = 'ExtendInterestsForMyInterests1784334200000';

  private readonly columns: Array<[string, string]> = [
    ['isRead', 'tinyint(1) NOT NULL DEFAULT 0'],
    ['readAt', 'datetime NULL'],
    ['respondedAt', 'datetime NULL'],
    ['withdrawnAt', 'datetime NULL'],
    ['source', 'varchar(32) NULL'],
    ['updatedAt', 'datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6)'],
  ];

  private readonly indexes: Array<[string, string]> = [
    ['IDX_interests_to_created', '`toUserId`, `createdAt`'],
    ['IDX_interests_from_created', '`fromUserId`, `createdAt`'],
    ['IDX_interests_status', '`status`'],
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('interests'))) return;

    await queryRunner.query(
      "ALTER TABLE `interests` MODIFY `status` ENUM('pending','accepted','declined','withdrawn') NOT NULL DEFAULT 'pending'",
    );

    for (const [name, type] of this.columns) {
      if (!(await queryRunner.hasColumn('interests', name))) {
        await queryRunner.query(`ALTER TABLE \`interests\` ADD \`${name}\` ${type}`);
      }
    }

    // Back-fill: answered interests count as read; respondedAt from the existing acceptedOn.
    await queryRunner.query("UPDATE `interests` SET `isRead` = 1 WHERE `status` <> 'pending'");
    await queryRunner.query(
      "UPDATE `interests` SET `respondedAt` = `acceptedOn` WHERE `status` = 'accepted' AND `respondedAt` IS NULL",
    );
    await queryRunner.query('UPDATE `interests` SET `updatedAt` = `createdAt`');

    const existing: { Key_name: string }[] = await queryRunner.query('SHOW INDEX FROM `interests`');
    const names = new Set(existing.map(i => i.Key_name));
    for (const [name, cols] of this.indexes) {
      if (!names.has(name)) await queryRunner.query(`CREATE INDEX \`${name}\` ON \`interests\` (${cols})`);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('interests'))) return;

    const existing: { Key_name: string }[] = await queryRunner.query('SHOW INDEX FROM `interests`');
    const names = new Set(existing.map(i => i.Key_name));
    for (const [name] of this.indexes) {
      if (names.has(name)) await queryRunner.query(`DROP INDEX \`${name}\` ON \`interests\``);
    }
    for (const [name] of this.columns) {
      if (await queryRunner.hasColumn('interests', name)) {
        await queryRunner.query(`ALTER TABLE \`interests\` DROP COLUMN \`${name}\``);
      }
    }
    // Withdrawn rows cannot be represented after rollback — keep them as declined.
    await queryRunner.query("UPDATE `interests` SET `status` = 'declined' WHERE `status` = 'withdrawn'");
    await queryRunner.query(
      "ALTER TABLE `interests` MODIFY `status` ENUM('pending','accepted','declined') NOT NULL DEFAULT 'pending'",
    );
  }
}
