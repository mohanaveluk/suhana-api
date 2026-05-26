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

  @Column({ type: 'json', nullable: true })
  compatibilityBreakdown: {
    lifestyle: number;
    education: number;
    location: number;
    familyValues: number;
    interests: number;
    career: number;
    emotional: number;
    horoscope?: number;
  };

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
