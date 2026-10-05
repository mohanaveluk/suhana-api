import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

import { PersonalityDimension } from '../enums/personality.enums';
import { PersonalityQuestionOption } from './personality-question-option.entity';

/**
 * One assessment statement, scored on a single dimension.
 *
 * Questions are never hard-deleted once answered (responses reference them with
 * ON DELETE RESTRICT) — retire one by clearing `activeFlag` so historical
 * assessments stay explainable.
 *
 * `questionText` is the default (English) copy; `translations` holds per-locale
 * overrides keyed by BCP-47 code, e.g. { "ta": "...", "hi": "..." }.
 */
@Entity('personality_questions')
@Index('UQ_PERSONALITY_QUESTIONS_CODE', ['questionCode'], { unique: true })
// Drives GET /personality/questions: active questions in display order.
@Index('IDX_PERSONALITY_QUESTIONS_ACTIVE_ORDER', ['activeFlag', 'displayOrder'])
export class PersonalityQuestion {
  @PrimaryGeneratedColumn({ type: 'int' })
  id: number;

  // Stable, human-readable key (e.g. EI_01) — also the i18n lookup key.
  @Column({ type: 'varchar', length: 20, name: 'question_code' })
  questionCode: string;

  @Column({ type: 'varchar', length: 500, name: 'question_text' })
  questionText: string;

  @Column({ type: 'enum', enum: PersonalityDimension })
  dimension: PersonalityDimension;

  @Column({ type: 'json', nullable: true })
  translations: Record<string, string> | null;

  @Column({ type: 'boolean', default: true, name: 'active_flag' })
  activeFlag: boolean;

  @Column({ type: 'int', name: 'display_order' })
  displayOrder: number;

  @OneToMany(() => PersonalityQuestionOption, (option) => option.question)
  options: PersonalityQuestionOption[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
