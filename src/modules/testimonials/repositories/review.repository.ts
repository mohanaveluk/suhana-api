import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { UserReview } from '../entity/user-review.entity';
import {
  ReviewSort,
  ReviewStatus,
  ReviewType,
} from '../enums/testimonial.enums';
import { PublicReviewQueryDto } from '../dto/review.dto';
import { filter } from 'rxjs';

// Encapsulates every persistence concern for reviews. Services depend on this,
// never on the TypeORM repository directly.
@Injectable()
export class ReviewRepository {
  constructor(
    @InjectRepository(UserReview)
    private readonly repo: Repository<UserReview>,
  ) {}

  create(data: Partial<UserReview>): UserReview {
    return this.repo.create(data);
  }

  save(review: UserReview): Promise<UserReview> {
    return this.repo.save(review);
  }

  findById(id: string): Promise<UserReview | null> {
    return this.repo.findOne({ where: { id } });
  }

  async softDelete(id: string): Promise<void> {
    await this.repo.softDelete(id);
  }

  async incrementCounter(
    id: string,
    field: 'likeCount' | 'replyCount' | 'reportCount' | 'viewCount',
    delta: number,
  ): Promise<void> {
    if (delta >= 0) await this.repo.increment({ id }, field, delta);
    else await this.repo.decrement({ id }, field, Math.abs(delta));
  }

  // ── Listings ───────────────────────────────────────────────────────────
  findByUser(userId: string, skip: number, take: number): Promise<[UserReview[], number]> {
    return this.repo.findAndCount({
      where: { userId },
      order: { createdAt: 'DESC' },
      skip,
      take,
    });
  }

  findPublic(query: PublicReviewQueryDto, skip: number, take: number): Promise<[UserReview[], number]> {
    const qb = this.repo
      .createQueryBuilder('r')
      .where('r.status = :status', { status: ReviewStatus.APPROVED });

    if (query.reviewType) qb.andWhere('r.review_type = :type', { type: query.reviewType });
    if (query.rating) qb.andWhere('r.overall_rating = :rating', { rating: query.rating });
    if (query.keyword) {
      qb.andWhere('(r.title LIKE :kw OR r.review_text LIKE :kw)', { kw: `%${query.keyword}%` });
    }

    this.applySort(qb, query.sort);
    return qb.skip(skip).take(take).getManyAndCount();
  }

  findFeatured(): Promise<UserReview[]> {
    return this.repo.find({
      where: { status: ReviewStatus.APPROVED, isFeatured: true },
      order: { featuredOrder: 'ASC', createdAt: 'DESC' },
    });
  }

  findPending(skip: number, take: number): Promise<[UserReview[], number]> {
    return this.repo.findAndCount({
      where: { status: ReviewStatus.PENDING },
      order: { createdAt: 'ASC' },
      skip,
      take,
    });
  }

   findApproved(skip: number, take: number): Promise<[UserReview[], number]> {
    return this.repo.findAndCount({
      where: { status: ReviewStatus.APPROVED },
      order: { createdAt: 'ASC' },
      skip,
      take,
    });
  }

  // Flexible admin listing: optional status and/or featured filters. When
  // neither is set, returns all reviews across every status. Featured lists are
  // ordered by featuredOrder (homepage order); otherwise newest-first.
  findByFilters(
    filters: { status?: ReviewStatus; featured?: boolean , reviewType: ReviewType},
    skip: number,
    take: number,
  ): Promise<[UserReview[], number]> {
    const qb = this.repo.createQueryBuilder('r');

    if (filters.status) qb.andWhere('r.status = :status', { status: filters.status });
    if (filters.featured !== undefined) {
      qb.andWhere('r.is_featured = :featured', { featured: filters.featured });
    }
    if(filters.reviewType != undefined){
      qb.andWhere('r.review_type = :type', {type: filters.reviewType});
    }

    if (filters.featured) {
      qb.orderBy('r.featured_order', 'ASC').addOrderBy('r.created_at', 'DESC');
    } else {
      qb.orderBy('r.created_at', 'DESC');
    }

    return qb.skip(skip).take(take).getManyAndCount();
  }
  // ── Stats / dashboard ────────────────────────────────────────────────────
  async getRatingStats(): Promise<{
    totalReviews: number;
    averageRating: number;
    fiveStar: number;
    fourStar: number;
    threeStar: number;
    twoStar: number;
    oneStar: number;
  }> {
    const rows = await this.repo
      .createQueryBuilder('r')
      .select('r.overall_rating', 'rating')
      .addSelect('COUNT(*)', 'count')
      .where('r.status = :status', { status: ReviewStatus.APPROVED })
      .groupBy('r.overall_rating')
      .getRawMany<{ rating: number; count: string }>();

    const byStar = new Map<number, number>();
    let total = 0;
    let weighted = 0;
    for (const row of rows) {
      const rating = Number(row.rating);
      const count = Number(row.count);
      byStar.set(rating, count);
      total += count;
      weighted += rating * count;
    }
    return {
      totalReviews: total,
      averageRating: total ? Math.round((weighted / total) * 10) / 10 : 0,
      fiveStar: byStar.get(5) ?? 0,
      fourStar: byStar.get(4) ?? 0,
      threeStar: byStar.get(3) ?? 0,
      twoStar: byStar.get(2) ?? 0,
      oneStar: byStar.get(1) ?? 0,
    };
  }

  countByStatus(status: ReviewStatus): Promise<number> {
    return this.repo.count({ where: { status } });
  }

  countFeatured(): Promise<number> {
    return this.repo.count({ where: { isFeatured: true, status: ReviewStatus.APPROVED } });
  }

  async approvedAverageRating(): Promise<number> {
    const raw = await this.repo
      .createQueryBuilder('r')
      .select('AVG(r.overall_rating)', 'avg')
      .where('r.status = :status', { status: ReviewStatus.APPROVED })
      .getRawOne<{ avg: string | null }>();
    return raw?.avg ? Math.round(Number(raw.avg) * 10) / 10 : 0;
  }

  async sumCounter(field: 'like_count' | 'reply_count' | 'report_count'): Promise<number> {
    const raw = await this.repo
      .createQueryBuilder('r')
      .select(`COALESCE(SUM(r.${field}), 0)`, 'total')
      .getRawOne<{ total: string }>();
    return Number(raw?.total ?? 0);
  }

  // ── Analytics ─────────────────────────────────────────────────────────────
  // Daily counts of approved reviews within the window.
  reviewTrends(sinceDays: number): Promise<{ day: string; count: string; avgRating: string }[]> {
    return this.repo
      .createQueryBuilder('r')
      .select('DATE(r.created_at)', 'day')
      .addSelect('COUNT(*)', 'count')
      .addSelect('AVG(r.overall_rating)', 'avgRating')
      .where('r.status = :status', { status: ReviewStatus.APPROVED })
      .andWhere('r.created_at >= :since', { since: this.daysAgo(sinceDays) })
      .groupBy('DATE(r.created_at)')
      .orderBy('day', 'ASC')
      .getRawMany();
  }

  topReviewedCategories(): Promise<{ reviewType: ReviewType; count: string }[]> {
    return this.repo
      .createQueryBuilder('r')
      .select('r.review_type', 'reviewType')
      .addSelect('COUNT(*)', 'count')
      .where('r.status = :status', { status: ReviewStatus.APPROVED })
      .groupBy('r.review_type')
      .orderBy('count', 'DESC')
      .getRawMany();
  }

  mostLiked(limit: number): Promise<UserReview[]> {
    return this.repo.find({
      where: { status: ReviewStatus.APPROVED },
      order: { likeCount: 'DESC' },
      take: limit,
    });
  }

  mostActiveReviewers(limit: number): Promise<{ userId: string; count: string }[]> {
    return this.repo
      .createQueryBuilder('r')
      .select('r.user_id', 'userId')
      .addSelect('COUNT(*)', 'count')
      .groupBy('r.user_id')
      .orderBy('count', 'DESC')
      .limit(limit)
      .getRawMany();
  }

  private applySort(qb: SelectQueryBuilder<UserReview>, sort?: ReviewSort): void {
    switch (sort) {
      case ReviewSort.OLDEST:
        qb.orderBy('r.created_at', 'ASC');
        break;
      case ReviewSort.MOST_LIKED:
        qb.orderBy('r.like_count', 'DESC').addOrderBy('r.created_at', 'DESC');
        break;
      case ReviewSort.HIGHEST_RATED:
        qb.orderBy('r.overall_rating', 'DESC').addOrderBy('r.created_at', 'DESC');
        break;
      case ReviewSort.LATEST:
      default:
        qb.orderBy('r.created_at', 'DESC');
    }
  }

  private daysAgo(days: number): Date {
    return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  }
}
