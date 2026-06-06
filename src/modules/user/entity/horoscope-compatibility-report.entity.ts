import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
} from 'typeorm';

@Entity('horoscope_compatibility_reports')
export class HoroscopeCompatibilityReport {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userOneId: string;

  @Column()
  userTwoId: string;

  @Column({ type: 'date', nullable: true })
  userOneDateOfBirth: Date;

  @Column({ nullable: true })
  userOneTimeOfBirth: string;

  @Column({ nullable: true })
  userOnePlaceOfBirth: string;

  @Column({ type: 'date', nullable: true })
  userTwoDateOfBirth: Date;

  @Column({ nullable: true })
  userTwoTimeOfBirth: string;

  @Column({ nullable: true })
  userTwoPlaceOfBirth: string;

  @Column({ type: 'json' })
  report: Record<string, any>;

  @CreateDateColumn()
  createdAt: Date;
}
