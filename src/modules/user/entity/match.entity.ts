import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn,
} from 'typeorm';
import { User } from './user.entity';

@Entity('matches')
export class Match {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { eager: true })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  userId: string;

  @ManyToOne(() => User, { eager: true })
  @JoinColumn({ name: 'matchedUserId' })
  matchedUser: User;

  @Column()
  matchedUserId: string;

  @Column({ type: 'float', default: 0 })
  matchPercentage: number;

  // Keyed score map. Different scorers write different key sets into this JSON
  // column (rule-based: religion/motherTongue/ageGap/income/…; random: lifestyle/
  // interests/emotional/…), so keep the type open rather than a fixed shape.
  @Column({ type: 'json', nullable: true })
  compatibilityBreakdown: Record<string, number>;

  @Column({ type: 'text', nullable: true })
  explanationText: string;

  @Column({ type: 'json', nullable: true })
  badges: { label: string; icon: string; score: number }[];

  @Column({
    type: 'enum',
    enum: ['suggested', 'shortlisted', 'interested', 'connected', 'skipped', 'reconsidered'],
    default: 'suggested',
  })
  status: string;

  @Column({ default: 0 })
  currentStep: number;

  @CreateDateColumn()
  suggestedAt: Date;
}
