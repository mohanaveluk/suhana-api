import {
  BeforeInsert,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { v4 as uuidv4 } from 'uuid';

import { Profile } from '../../user/entity/profile.entity';
import { AssessmentStatus } from '../enums/personality.enums';
import { PersonalityResponse } from './personality-response.entity';

// MySQL DECIMAL comes back as a string — normalise to number | null.
const decimalTransformer = {
  to: (value: number | null) => value,
  from: (value: string | null) =>
    value === null || value === undefined ? null : Number(value),
};

/**
 * One attempt at the assessment by a profile.
 *
 * Created IN_PROGRESS by /assessment/start and filled in on submit. Retakes
 * create a new row, so history is kept and the profile's current result is
 * simply its most recent COMPLETED assessment.
 *
 * Pole scores are raw points (0 – 2 × questions on that dimension).
 */
@Entity('personality_assessments')
// Current-result lookup: latest COMPLETED for a profile.
@Index('IDX_PERSONALITY_ASSESSMENTS_PROFILE_STATUS', [
  'profileId',
  'status',
  'completedDate',
])
// Supports future matchmaking/search filters by type.
@Index('IDX_PERSONALITY_ASSESSMENTS_TYPE', ['personalityType'])
export class PersonalityAssessment {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id: string;

  @BeforeInsert()
  generateId(): void {
    if (!this.id) this.id = uuidv4();
  }

  @Column({ type: 'varchar', length: 36, name: 'profile_id' })
  profileId: string;

  // No DB-level FK: profiles predates this table and its collation is not
  // guaranteed to match, same approach as profile_visits.
  @ManyToOne(() => Profile, {
    eager: false,
    createForeignKeyConstraints: false,
  })
  @JoinColumn({ name: 'profile_id' })
  profile: Profile;

  @Column({
    type: 'enum',
    enum: AssessmentStatus,
    default: AssessmentStatus.IN_PROGRESS,
  })
  status: AssessmentStatus;

  @Column({ type: 'datetime', nullable: true, name: 'completed_date' })
  completedDate: Date | null;

  @Column({ type: 'char', length: 4, nullable: true, name: 'personality_type' })
  personalityType: string | null;

  // Percentage 0–100.
  @Column({
    type: 'decimal',
    precision: 5,
    scale: 2,
    nullable: true,
    name: 'confidence_score',
    transformer: decimalTransformer,
  })
  confidenceScore: number | null;

  @Column({
    type: 'smallint',
    unsigned: true,
    default: 0,
    name: 'introversion_score',
  })
  introversionScore: number;

  @Column({
    type: 'smallint',
    unsigned: true,
    default: 0,
    name: 'extroversion_score',
  })
  extroversionScore: number;

  @Column({
    type: 'smallint',
    unsigned: true,
    default: 0,
    name: 'sensing_score',
  })
  sensingScore: number;

  @Column({
    type: 'smallint',
    unsigned: true,
    default: 0,
    name: 'intuition_score',
  })
  intuitionScore: number;

  @Column({
    type: 'smallint',
    unsigned: true,
    default: 0,
    name: 'thinking_score',
  })
  thinkingScore: number;

  @Column({
    type: 'smallint',
    unsigned: true,
    default: 0,
    name: 'feeling_score',
  })
  feelingScore: number;

  @Column({
    type: 'smallint',
    unsigned: true,
    default: 0,
    name: 'judging_score',
  })
  judgingScore: number;

  @Column({
    type: 'smallint',
    unsigned: true,
    default: 0,
    name: 'perceiving_score',
  })
  perceivingScore: number;

  @OneToMany(() => PersonalityResponse, (response) => response.assessment)
  responses: PersonalityResponse[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
