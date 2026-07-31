import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ReviewReply } from '../entity/review-reply.entity';

@Injectable()
export class ReviewReplyRepository {
  constructor(
    @InjectRepository(ReviewReply)
    private readonly repo: Repository<ReviewReply>,
  ) {}

  create(data: Partial<ReviewReply>): ReviewReply {
    return this.repo.create(data);
  }

  save(reply: ReviewReply): Promise<ReviewReply> {
    return this.repo.save(reply);
  }

  findById(id: string): Promise<ReviewReply | null> {
    return this.repo.findOne({ where: { id } });
  }

  // All replies for a review, chronological — the service builds the tree.
  findByReview(reviewId: string): Promise<ReviewReply[]> {
    return this.repo.find({
      where: { reviewId },
      order: { createdAt: 'ASC' },
    });
  }

  countByReview(reviewId: string): Promise<number> {
    return this.repo.count({ where: { reviewId } });
  }

  countAll(): Promise<number> {
    return this.repo.count();
  }
}
