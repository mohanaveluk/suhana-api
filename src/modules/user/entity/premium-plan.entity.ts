import {
  Entity, PrimaryGeneratedColumn, Column,
} from 'typeorm';

@Entity('premium_plans')
export class PremiumPlan {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ type: 'enum', enum: ['free', 'silver', 'gold', 'platinum'] })
  tier: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  price: number;

  @Column()
  duration: string;

  @Column({ type: 'json' })
  features: string[];

  @Column({ default: false })
  isPopular: boolean;
}
