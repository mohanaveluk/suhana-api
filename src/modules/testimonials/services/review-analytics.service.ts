import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../user/entity/user.entity';
import { ReviewRepository } from '../repositories/review.repository';

@Injectable()
export class ReviewAnalyticsService {
  constructor(
    private readonly reviewRepo: ReviewRepository,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
  ) {}

  // Aggregated analytics for the business dashboard.
  async getAnalytics(days = 90) {
    const [trendsRaw, categoriesRaw, mostLiked, reviewersRaw] = await Promise.all([
      this.reviewRepo.reviewTrends(days),
      this.reviewRepo.topReviewedCategories(),
      this.reviewRepo.mostLiked(10),
      this.reviewRepo.mostActiveReviewers(10),
    ]);

    // Review trend + average-rating trend (per day) + cumulative growth.
    let cumulative = 0;
    const reviewTrends = trendsRaw.map((t) => {
      const count = Number(t.count);
      cumulative += count;
      return {
        date: t.day,
        count,
        averageRating: t.avgRating ? Math.round(Number(t.avgRating) * 10) / 10 : 0,
        cumulative,
      };
    });

    const topReviewedCategories = categoriesRaw.map((c) => ({
      reviewType: c.reviewType,
      count: Number(c.count),
    }));

    const authors = await this.resolveNames(reviewersRaw.map((r) => r.userId));
    const mostActiveReviewers = reviewersRaw.map((r) => ({
      userId: r.userId,
      name: authors.get(r.userId) ?? 'Aurora Member',
      reviewCount: Number(r.count),
    }));

    return {
      reviewTrends, // review growth + count per day
      averageRatingTrend: reviewTrends.map((t) => ({ date: t.date, averageRating: t.averageRating })),
      reviewGrowth: { windowDays: days, totalInWindow: cumulative },
      topReviewedCategories,
      mostLikedReviews: mostLiked.map((r) => ({
        id: r.id,
        title: r.title,
        likeCount: r.likeCount,
        overallRating: r.overallRating,
      })),
      mostActiveReviewers,
    };
  }

  private async resolveNames(userIds: string[]): Promise<Map<string, string>> {
    const unique = [...new Set(userIds)].filter(Boolean);
    const map = new Map<string, string>();
    if (!unique.length) return map;
    const users = await this.userRepo.find({ where: unique.map((id) => ({ id })) });
    for (const u of users) {
      map.set(u.id, [u.first_name, u.last_name].filter(Boolean).join(' ').trim() || 'Aurora Member');
    }
    return map;
  }
}
