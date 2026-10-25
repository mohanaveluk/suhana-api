import { MigrationInterface, QueryRunner } from 'typeorm';

// Adds free-text address lines and family-member names to profiles.
// (Lagna / Tossing live inside the existing `horoscope` JSON column — no DDL needed.)
export class AddProfileAddressAndFamilyNames1784334100000 implements MigrationInterface {
  name = 'AddProfileAddressAndFamilyNames1784334100000';

  private readonly columns: Array<[string, string]> = [
    ['addressLine1', 'varchar(255)'],
    ['addressLine2', 'varchar(255)'],
    ['fatherName', 'varchar(150)'],
    ['motherName', 'varchar(150)'],
    ['brothers', 'varchar(255)'],
    ['sisters', 'varchar(255)'],
  ];

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('profiles'))) return;
    for (const [name, type] of this.columns) {
      if (!(await queryRunner.hasColumn('profiles', name))) {
        await queryRunner.query(`ALTER TABLE \`profiles\` ADD \`${name}\` ${type} NULL`);
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('profiles'))) return;
    for (const [name] of this.columns) {
      if (await queryRunner.hasColumn('profiles', name)) {
        await queryRunner.query(`ALTER TABLE \`profiles\` DROP COLUMN \`${name}\``);
      }
    }
  }
}
