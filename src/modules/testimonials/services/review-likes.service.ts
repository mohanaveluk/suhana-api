import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { UserReview } from '../entity/user-review.entity';
import { ReviewLike } from '../entity/review-like.entity';
import { ReviewRepository } from '../repositories/review.repository';
import { ReviewLikeRepository } from '../repositories/review-like.repository';
import { ReviewStatus } from '../enums/testimonial.enums';

@Injectable()
export class ReviewLikesService {
  constructor(
    private readonly reviewRepo: ReviewRepository,
    private readonly likeRepo: ReviewLikeRepository,
    private readonly dataSource: DataSource,
  ) {}

  // BR5: a user can like a review only once. The DB unique constraint is the
  // hard guarantee; the pre-check gives a friendly error under normal flow.
  async like(reviewId: string, userId: string): Promise<{ liked: boolean; likeCount: number }> {
    const review = await this.requireApproved(reviewId);
    if (await this.likeRepo.findOne(reviewId, userId)) {
      throw new ConflictException('You have already liked this review.');
    }

    try {
      await this.dataSource.transaction(async (manager) => {
        await manager.getRepository(ReviewLike).save(
          manager.getRepository(ReviewLike).create({ reviewId, userId }),
        );
        await manager.getRepository(UserReview).increment({ id: reviewId }, 'likeCount', 1);
      });
    } catch (err: any) {
      // Unique violation under a race → treat as already liked.
      if (err?.code === 'ER_DUP_ENTRY') {
        throw new ConflictException('You have already liked this review.');
      }
      throw err;
    }

    return { liked: true, likeCount: review.likeCount + 1 };
  }

  async unlike(reviewId: string, userId: string): Promise<{ liked: boolean; likeCount: number }> {
    const review = await this.requireApproved(reviewId);

    const likeCount = await this.dataSource.transaction(async (manager) => {
      const result = await manager.getRepository(ReviewLike).delete({ reviewId, userId });
      if ((result.affected ?? 0) > 0) {
        await manager.getRepository(UserReview).decrement({ id: reviewId }, 'likeCount', 1);
        return Math.max(0, review.likeCount - 1);
      }
      return review.likeCount;
    });

    return { liked: false, likeCount };
  }

  private async requireApproved(reviewId: string): Promise<UserReview> {
    const review = await this.reviewRepo.findById(reviewId);
    if (!review || review.status !== ReviewStatus.APPROVED) {
      throw new NotFoundException('Review not found');
    }
    return review;
  }
}
