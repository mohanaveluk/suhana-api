import {
  BeforeInsert,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { v4 as uuidv4 } from 'uuid';

import { PersonalityAssessment } from './personality-assessment.entity';
import { PersonalityQuestion } from './personality-question.entity';
import { PersonalityQuestionOption } from './personality-question-option.entity';

/** The option a member picked for one question within one assessment. */
@Entity('personality_responses')
// One answer per question per assessment.
@Index(
  'UQ_PERSONALITY_RESPONSES_ASSESSMENT_QUESTION',
  ['assessmentId', 'questionId'],
  { unique: true },
)
export class PersonalityResponse {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id: string;

  @BeforeInsert()
  generateId(): void {
    if (!this.id) this.id = uuidv4();
  }

  @Column({ type: 'varchar', length: 36, name: 'assessment_id' })
  assessmentId: string;

  @ManyToOne(
    () => PersonalityAssessment,
    (assessment) => assessment.responses,
    { onDelete: 'CASCADE' },
  )
  @JoinColumn({
    name: 'assessment_id',
    foreignKeyConstraintName: 'FK_PERSONALITY_RESPONSES_ASSESSMENT',
  })
  assessment: PersonalityAssessment;

  @Column({ type: 'int', name: 'question_id' })
  questionId: number;

  // RESTRICT: answered questions must be retired via active_flag, not deleted.
  @ManyToOne(() => PersonalityQuestion, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'question_id',
    foreignKeyConstraintName: 'FK_PERSONALITY_RESPONSES_QUESTION',
  })
  question: PersonalityQuestion;

  @Column({ type: 'int', name: 'selected_option_id' })
  selectedOptionId: number;

  @ManyToOne(() => PersonalityQuestionOption, { onDelete: 'RESTRICT' })
  @JoinColumn({
    name: 'selected_option_id',
    foreignKeyConstraintName: 'FK_PERSONALITY_RESPONSES_OPTION',
  })
  selectedOption: PersonalityQuestionOption;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
