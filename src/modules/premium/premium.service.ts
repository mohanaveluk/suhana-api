import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DeepPartial } from 'typeorm';
import { PremiumPlan, User } from '../user/entity';

@Injectable()
export class PremiumService {
  constructor(
    @InjectRepository(PremiumPlan) private readonly planRepo: Repository<PremiumPlan>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
  ) {}

  async getPlans() {
    const plans = await this.planRepo.find({ order: { price: 'ASC' } });
    if (plans.length === 0) {
      // Seed default plans
      return this.seedPlans();
    }
    return plans;
  }

  async getPlanById(id: string) {
    const plan = await this.planRepo.findOne({ where: { id } });
    if (!plan) throw new NotFoundException('Plan not found');
    return plan;
  }

  async subscribe(userId: string, planId: string) {
    const plan = await this.getPlanById(planId);
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    user.membership = plan.tier;
    await this.userRepo.save(user);

    return {
      message: `Successfully subscribed to ${plan.name} plan`,
      membership: plan.tier,
      plan,
    };
  }

  private async seedPlans() {
    const defaults = [
      {
        name: 'Free', tier: 'free', price: 0, duration: 'Forever', isPopular: false,
        features: ['Create profile', 'Browse limited profiles', 'View 2 matches/day', 'Basic search filters', 'Email support'],
      },
      {
        name: 'Silver', tier: 'silver', price: 999, duration: '3 months', isPopular: false,
        features: ['All Free features', 'View 10 matches/day', 'Advanced search filters', 'See who viewed your profile', 'Send 5 interests/day', 'Chat unlock on mutual interest'],
      },
      {
        name: 'Gold', tier: 'gold', price: 2499, duration: '6 months', isPopular: true,
        features: ['All Silver features', 'Unlimited matches', 'Priority in search results', 'Video call unlock', 'Horoscope matching', 'Dedicated relationship advisor'],
      },
      {
        name: 'Platinum', tier: 'platinum', price: 4999, duration: '12 months', isPopular: false,
        features: ['All Gold features', 'Profile boost every week', 'Featured profile badge', 'Background verification', 'Personal matchmaker', 'VIP events access', 'Money-back guarantee'],
      },
    ];

    const saved: PremiumPlan[] = [];
    for (const d of defaults) {
      const entity = this.planRepo.create(d as DeepPartial<PremiumPlan>);
      saved.push(await this.planRepo.save(entity));
    }
    return saved;
  }
}
