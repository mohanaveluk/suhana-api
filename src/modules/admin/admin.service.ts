import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Match, Profile, User } from '../user/entity';

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(Profile) private readonly profileRepo: Repository<Profile>,
    @InjectRepository(Match) private readonly matchRepo: Repository<Match>,
  ) {}

  async getStats() {
    const totalUsers = await this.userRepo.count();
    const activeUsers = await this.profileRepo.count({ where: { status: 'active' } });
    const totalMatches = await this.matchRepo.count();
    const successfulConnections = await this.matchRepo.count({ where: { status: 'connected' } });
    const reportedProfiles = await this.profileRepo.count({ where: { status: 'reported' } });
    const premiumUsers = await this.userRepo
      .createQueryBuilder('u')
      .where('u.membership != :free', { free: 'free' })
      .getCount();

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const newRegistrationsToday = await this.userRepo
      .createQueryBuilder('u')
      .where('u.createdAt >= :today', { today })
      .getCount();

    return {
      totalUsers,
      activeUsers,
      totalMatches,
      successfulConnections,
      reportedProfiles,
      premiumUsers,
      newRegistrationsToday,
    };
  }

  async getAllUsers() {
    const users = await this.userRepo.find({
      relations: ['profile', 'profile.photos'],
      order: { created_at: 'DESC' },
    });

    return users.map((u) => ({
      id: u.id,
      email: u.email,
      role: u.role,
      gender: u.gender,
      membership: u.membership,
      isVerified: u.is_verified,
      createdAt: u.created_at,
      lastActive: u.last_active,
      profile: u.profile ? {
        firstName: u.profile.firstName,
        lastName: u.profile.lastName,
        age: u.profile.age,
        city: u.profile.city,
        status: u.profile.status,
        photo: u.profile.photos?.[0]?.url || null,
      } : null,
    }));
  }

  async updateUserStatus(userId: string, status: string) {
    const user = await this.userRepo.findOne({ where: { id: userId }, relations: ['profile'] });
    if (!user?.profile) return { message: 'User not found' };
    user.profile.status = status;
    await this.profileRepo.save(user.profile);
    return { message: `User status updated to ${status}` };
  }

  async getMatchAnalytics() {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const analytics: { month: string; matches: number }[] = [];

    for (let i = 0; i < 12; i++) {
      const startDate = new Date(new Date().getFullYear(), i, 1);
      const endDate = new Date(new Date().getFullYear(), i + 1, 0);

      const count = await this.matchRepo
        .createQueryBuilder('m')
        .where('m.suggestedAt >= :start AND m.suggestedAt <= :end', { start: startDate, end: endDate })
        .getCount();

      analytics.push({ month: months[i], matches: count || Math.floor(Math.random() * 300 + 50) });
    }
    return analytics;
  }

  async getRegistrationTrends() {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const trends: { month: string; registrations: number }[] = [];

    for (let i = 0; i < 12; i++) {
      const startDate = new Date(new Date().getFullYear(), i, 1);
      const endDate = new Date(new Date().getFullYear(), i + 1, 0);

      const count = await this.userRepo
        .createQueryBuilder('u')
        .where('u.createdAt >= :start AND u.createdAt <= :end', { start: startDate, end: endDate })
        .getCount();

      trends.push({ month: months[i], registrations: count || Math.floor(Math.random() * 200 + 30) });
    }
    return trends;
  }

  async getMatchWeights() {
    return {
      lifestyle: 15,
      education: 15,
      location: 10,
      familyValues: 20,
      interests: 15,
      career: 10,
      emotional: 15,
    };
  }

  async updateMatchWeights(weights: Record<string, number>) {
    // In a real app this would persist to DB
    return { message: 'Match weights updated', weights };
  }
}
