import { MigrationInterface, QueryRunner } from 'typeorm';

// Adds profile.voiceIntroductionUrl — the public GCS URL of the member's
// 30-second voice introduction, set from POST /profile/voice/upload.
//
// Column name is camelCase to match the surrounding Profile columns
// (videoIntroUrl, horoscopeDocUrl), which use TypeORM's default naming strategy.
export class AddProfileVoiceIntroductionUrl1784333400000 implements MigrationInterface {
  name = 'AddProfileVoiceIntroductionUrl1784333400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('profiles'))) return;

    if (!(await queryRunner.hasColumn('profiles', 'voiceIntroductionUrl'))) {
      await queryRunner.query(
        `ALTER TABLE \`profiles\` ADD \`voiceIntroductionUrl\` varchar(500) NULL`,
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('profiles'))) return;

    if (await queryRunner.hasColumn('profiles', 'voiceIntroductionUrl')) {
      await queryRunner.query(
        `ALTER TABLE \`profiles\` DROP COLUMN \`voiceIntroductionUrl\``,
      );
    }
  }
}
