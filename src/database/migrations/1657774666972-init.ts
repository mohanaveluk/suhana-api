import { MigrationInterface, QueryRunner, Table  } from 'typeorm';

export class init1657774666972 implements MigrationInterface {

  public async up(queryRunner: QueryRunner): Promise<void> {

    await queryRunner.createTable(
      new Table({
        name: 'roles',
        columns: [
          {
            name: 'id',
            type: "int",
            isPrimary: true,
            isUnique: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },          {
            name: 'guid',
            type: "varchar",
            length: '100',
            isNullable: false,
            isUnique: true,
            generationStrategy: 'uuid'
          },
          {
            name: 'name',
            type: 'varchar',
            length: '100',
            isNullable: false,
          },
          {
            name: 'is_active',
            type: 'boolean',
            isNullable: false,
            default: true,
          }          
        ],
      }),
      true,
    );

    //applications
    await queryRunner.query(`
          INSERT INTO roles (name, guid) VALUES 
          ('admin',      '526e949f-0a09-4e9b-b196-4f6680f526d6')
          ,('guest',      'ee64f6df-c3ec-427d-beaa-735b460664a7')
          ,('registered', '5442c633-c449-46c2-96b1-3bf81c6e39ff')
          ,('tester',     '28a5c240-6536-4d20-b51f-17f4a16fcd80')
          ,('user',        '491743dd-616c-4c2f-bab3-f0f8350eba46');
          `);
    
  }

  public async down(queryRunner: QueryRunner): Promise<void> {

  }
}
