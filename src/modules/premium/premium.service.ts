import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DeepPartial } from 'typeorm';
import { PremiumPlan, User, UserSubscription } from '../user/entity';

@Injectable()
export class PremiumService {
  private readonly tierDurationMonths: Record<string, number | null> = {
    free: null,
    silver: 3,
    gold: 6,
    platinum: 12,
  };

  constructor(
    @InjectRepository(PremiumPlan) private readonly planRepo: Repository<PremiumPlan>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(UserSubscription) private readonly subscriptionRepo: Repository<UserSubscription>,
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

    // Expire any currently active subscription
    await this.subscriptionRepo.update({ userId, status: 'active' }, { status: 'expired' });

    const startDate = new Date();
    const months = this.tierDurationMonths[plan.tier];
    let endDate: Date | null = null;
    if (months !== null) {
      endDate = new Date(startDate);
      endDate.setMonth(endDate.getMonth() + months);
    }

    const subscription = await this.subscriptionRepo.save(
      this.subscriptionRepo.create({ userId, planId, tier: plan.tier, status: 'active', startDate, endDate }),
    );

    user.membership = plan.tier;
    await this.userRepo.save(user);

    return {
      message: `Successfully subscribed to ${plan.name} plan`,
      membership: plan.tier,
      plan,
      subscription,
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
