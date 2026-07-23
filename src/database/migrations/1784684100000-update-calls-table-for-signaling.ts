import { MigrationInterface, QueryRunner } from 'typeorm';

// Extends the `calls` table for real-time signaling: widens the status enum
// to the full call-lifecycle vocabulary, adds receiverId/answeredAt/socket-id
// tracking columns, and renames duration -> durationSeconds.
export class UpdateCallsTableForSignaling1784684100000 implements MigrationInterface {
  name = 'UpdateCallsTableForSignaling1784684100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Widen to VARCHAR first — the old ENUM can't hold the new status values, so
    // remapping in place would truncate. Narrow back to the final ENUM afterwards.
    await queryRunner.query(`ALTER TABLE \`calls\` MODIFY COLUMN \`status\` VARCHAR(20) NOT NULL DEFAULT 'initiated'`);

    await queryRunner.query(`UPDATE \`calls\` SET \`status\` = 'PENDING' WHERE \`status\` = 'initiated'`);
    await queryRunner.query(`UPDATE \`calls\` SET \`status\` = 'ACCEPTED' WHERE \`status\` = 'ongoing'`);
    await queryRunner.query(`UPDATE \`calls\` SET \`status\` = 'COMPLETED' WHERE \`status\` = 'ended'`);
    await queryRunner.query(`UPDATE \`calls\` SET \`status\` = 'MISSED' WHERE \`status\` = 'missed'`);

    await queryRunner.query(`
      ALTER TABLE \`calls\`
      MODIFY COLUMN \`status\` ENUM('PENDING','RINGING','ACCEPTED','DECLINED','MISSED','COMPLETED','FAILED') NOT NULL DEFAULT 'PENDING'
    `);

    await queryRunner.query(`
      ALTER TABLE \`calls\`
      ADD COLUMN \`receiverId\` varchar(255) NULL AFTER \`initiatedBy\`,
      ADD COLUMN \`answeredAt\` datetime NULL AFTER \`startedAt\`,
      ADD COLUMN \`callerSocketId\` varchar(255) NULL,
      ADD COLUMN \`receiverSocketId\` varchar(255) NULL,
      CHANGE COLUMN \`duration\` \`durationSeconds\` int NULL
    `);

    // Backfill receiverId from the conversation's other participant.
    await queryRunner.query(`
      UPDATE \`calls\` c
      JOIN \`conversations\` conv ON conv.id = c.conversationId
      SET c.receiverId = IF(c.initiatedBy = conv.participantOneId, conv.participantTwoId, conv.participantOneId)
      WHERE c.receiverId IS NULL
    `);

    await queryRunner.query(`
      CREATE INDEX \`IDX_calls_receiverId\` ON \`calls\` (\`receiverId\`)
    `);

    // Matches the FK TypeORM infers for the receiver ManyToOne relation on the Call entity.
    await queryRunner.query(`
      ALTER TABLE \`calls\`
      ADD CONSTRAINT \`FK_calls_receiverId\` FOREIGN KEY (\`receiverId\`) REFERENCES \`user\`(\`id\`) ON DELETE NO ACTION ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE \`calls\` DROP FOREIGN KEY \`FK_calls_receiverId\``);
    await queryRunner.query(`DROP INDEX \`IDX_calls_receiverId\` ON \`calls\``);

    await queryRunner.query(`
      ALTER TABLE \`calls\`
      DROP COLUMN \`receiverId\`,
      DROP COLUMN \`answeredAt\`,
      DROP COLUMN \`callerSocketId\`,
      DROP COLUMN \`receiverSocketId\`,
      CHANGE COLUMN \`durationSeconds\` \`duration\` int NULL
    `);

    await queryRunner.query(`ALTER TABLE \`calls\` MODIFY COLUMN \`status\` VARCHAR(20) NOT NULL DEFAULT 'PENDING'`);

    await queryRunner.query(`UPDATE \`calls\` SET \`status\` = 'initiated' WHERE \`status\` = 'PENDING'`);
    await queryRunner.query(`UPDATE \`calls\` SET \`status\` = 'ongoing' WHERE \`status\` = 'ACCEPTED'`);
    await queryRunner.query(`UPDATE \`calls\` SET \`status\` = 'ended' WHERE \`status\` = 'COMPLETED'`);
    await queryRunner.query(`UPDATE \`calls\` SET \`status\` = 'missed' WHERE \`status\` = 'MISSED'`);
    await queryRunner.query(`UPDATE \`calls\` SET \`status\` = 'missed' WHERE \`status\` IN ('RINGING', 'DECLINED', 'FAILED')`);

    await queryRunner.query(`
      ALTER TABLE \`calls\`
      MODIFY COLUMN \`status\` ENUM('initiated','ongoing','ended','missed') NOT NULL DEFAULT 'initiated'
    `);
  }
}
