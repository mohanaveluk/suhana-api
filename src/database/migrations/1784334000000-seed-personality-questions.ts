import { MigrationInterface, QueryRunner } from 'typeorm';

import {
  PERSONALITY_QUESTION_BANK,
  buildOptionSeeds,
} from '../../modules/personality/seed/personality-question-bank';

// Seeds the 32-question Aurora Personality Assessment (5 Likert options each).
// Skips entirely when the bank already exists, so it is safe on databases where
// the questions were loaded from src/database/personality-assessment.sql.
export class SeedPersonalityQuestions1784334000000
  implements MigrationInterface
{
  name = 'SeedPersonalityQuestions1784334000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const [{ count }] = await queryRunner.query(
      `SELECT COUNT(*) AS count FROM \`personality_questions\``,
    );
    if (Number(count) > 0) return;

    const questionRows = PERSONALITY_QUESTION_BANK.map(
      () => '(?, ?, ?, ?, 1, ?)',
    ).join(',\n');
    await queryRunner.query(
      `INSERT INTO \`personality_questions\`
         (\`id\`, \`question_code\`, \`question_text\`, \`dimension\`, \`active_flag\`, \`display_order\`)
       VALUES ${questionRows}`,
      PERSONALITY_QUESTION_BANK.flatMap((q) => [
        q.id,
        q.code,
        q.text,
        q.dimension,
        q.displayOrder,
      ]),
    );

    const options = PERSONALITY_QUESTION_BANK.flatMap((q) =>
      buildOptionSeeds(q).map((o) => [
        q.id,
        o.optionKey,
        o.optionText,
        o.scoreDirection,
        o.scoreValue,
        o.displayOrder,
      ]),
    );
    await queryRunner.query(
      `INSERT INTO \`personality_question_options\`
         (\`question_id\`, \`option_key\`, \`option_text\`, \`score_direction\`, \`score_value\`, \`display_order\`)
       VALUES ${options.map(() => '(?, ?, ?, ?, ?, ?)').join(',\n')}`,
      options.flat(),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Options cascade. Fails by design (FK RESTRICT) once members have answered.
    const ids = PERSONALITY_QUESTION_BANK.map((q) => q.id);
    await queryRunner.query(
      `DELETE FROM \`personality_questions\` WHERE \`id\` IN (${ids.map(() => '?').join(', ')})`,
      ids,
    );
  }
}
