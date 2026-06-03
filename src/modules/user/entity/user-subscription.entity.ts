import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn,
  ManyToOne, JoinColumn,
} from 'typeorm';
import { User } from './user.entity';
import { PremiumPlan } from './premium-plan.entity';

@Entity('user_subscriptions')
export class UserSubscription {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  planId: string;

  @ManyToOne(() => PremiumPlan)
  @JoinColumn({ name: 'planId' })
  plan: PremiumPlan;

  @Column({ type: 'enum', enum: ['free', 'silver', 'gold', 'platinum'] })
  tier: string;

  @Column({ type: 'enum', enum: ['active', 'expired', 'cancelled'], default: 'active' })
  status: string;

  @Column({ type: 'date' })
  startDate: Date;

  @Column({ type: 'date', nullable: true })
  endDate: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
