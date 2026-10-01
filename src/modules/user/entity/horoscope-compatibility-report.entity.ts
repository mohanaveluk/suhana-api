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

  // Invalidated (rather than deleted) when either member replaces their horoscope
  // document — see MatchesService.invalidateHoroscopeCache. Keeping the row lets
  // the stale report stay available for audit/debugging while findCachedReport
  // ignores it and a fresh one gets generated.
  @Column({ default: true, name: 'is_active' })
  isActive: boolean;

  @Column({ type: 'datetime', nullable: true, name: 'invalidated_at' })
  invalidatedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;
}
