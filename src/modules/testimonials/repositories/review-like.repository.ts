import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ReviewLike } from '../entity/review-like.entity';

@Injectable()
export class ReviewLikeRepository {
  constructor(
    @InjectRepository(ReviewLike)
    private readonly repo: Repository<ReviewLike>,
  ) {}

  findOne(reviewId: string, userId: string): Promise<ReviewLike | null> {
    return this.repo.findOne({ where: { reviewId, userId } });
  }

  create(reviewId: string, userId: string): ReviewLike {
    return this.repo.create({ reviewId, userId });
  }

  save(like: ReviewLike): Promise<ReviewLike> {
    return this.repo.save(like);
  }

  async remove(reviewId: string, userId: string): Promise<boolean> {
    const result = await this.repo.delete({ reviewId, userId });
    return (result.affected ?? 0) > 0;
  }

  findUserLikedReviewIds(userId: string, reviewIds: string[]): Promise<ReviewLike[]> {
    if (!reviewIds.length) return Promise.resolve([]);
    return this.repo
      .createQueryBuilder('l')
      .where('l.user_id = :userId', { userId })
      .andWhere('l.review_id IN (:...ids)', { ids: reviewIds })
      .getMany();
  }

  countAll(): Promise<number> {
    return this.repo.count();
  }
}
