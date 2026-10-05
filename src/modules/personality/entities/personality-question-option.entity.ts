import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';

import { PersonalityPole } from '../enums/personality.enums';
import { PersonalityQuestion } from './personality-question.entity';

/**
 * One answer choice and its score mapping.
 *
 * Scoring is stored per option as (pole, magnitude) rather than a signed value,
 * so the engine is a plain `scores[scoreDirection] += scoreValue`. For a question
 * keyed to E:
 *
 *   Strongly Agree    → E, 2      Disagree          → I, 1
 *   Agree             → E, 1      Strongly Disagree → I, 2
 *   Neutral           → E, 0
 *
 * which is the signed +2…-2 scale expressed toward a pole. Because the mapping
 * lives on the option, reverse-keyed questions (agree ⇒ I) need no code change.
 *
 * Score fields are never sent to clients.
 */
@Entity('personality_question_options')
@Index('UQ_PERSONALITY_OPTIONS_QUESTION_KEY', ['questionId', 'optionKey'], {
  unique: true,
})
export class PersonalityQuestionOption {
  @PrimaryGeneratedColumn({ type: 'int' })
  id: number;

  @Column({ type: 'int', name: 'question_id' })
  questionId: number;

  @ManyToOne(() => PersonalityQuestion, (question) => question.options, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({
    name: 'question_id',
    foreignKeyConstraintName: 'FK_PERSONALITY_OPTIONS_QUESTION',
  })
  question: PersonalityQuestion;

  // LikertOptionKey value — stable i18n key for the choice label.
  @Column({ type: 'varchar', length: 30, name: 'option_key' })
  optionKey: string;

  @Column({ type: 'varchar', length: 100, name: 'option_text' })
  optionText: string;

  @Column({ type: 'enum', enum: PersonalityPole, name: 'score_direction' })
  scoreDirection: PersonalityPole;

  @Column({ type: 'tinyint', unsigned: true, name: 'score_value' })
  scoreValue: number;

  @Column({ type: 'tinyint', unsigned: true, name: 'display_order' })
  displayOrder: number;

  @Column({ type: 'json', nullable: true })
  translations: Record<string, string> | null;
}
