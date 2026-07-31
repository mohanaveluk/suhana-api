import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { ReviewStatus, ReviewType, ReviewSentiment } from '../enums/testimonial.enums';

// Unit tests focus on the business rules (BR1, BR2, ownership) with all
// collaborators mocked.
describe('ReviewsService', () => {
  let service: ReviewsService;
  let reviewRepo: any;
  let replyRepo: any;
  let likeRepo: any;
  let sentiment: any;
  let audit: any;
  let userRepo: any;

  beforeEach(() => {
    reviewRepo = {
      create: jest.fn((x) => ({ id: 'r1', ...x })),
      save: jest.fn((x) => Promise.resolve(x)),
      findById: jest.fn(),
      softDelete: jest.fn().mockResolvedValue(undefined),
      incrementCounter: jest.fn().mockResolvedValue(undefined),
      findByUser: jest.fn().mockResolvedValue([[], 0]),
      getRatingStats: jest.fn(),
    };
    replyRepo = { findByReview: jest.fn().mockResolvedValue([]) };
    likeRepo = { findOne: jest.fn().mockResolvedValue(null) };
    sentiment = { analyzeReview: jest.fn().mockResolvedValue(ReviewSentiment.POSITIVE) };
    audit = { emit: jest.fn() };
    userRepo = { find: jest.fn().mockResolvedValue([]) };

    service = new ReviewsService(reviewRepo, replyRepo, likeRepo, sentiment, audit, userRepo);
  });

  describe('create', () => {
    it('creates a PENDING review, runs sentiment, and emits an audit event', async () => {
      const result = await service.create('u1', {
        title: 'Great service',
        reviewText: 'The matchmaking was excellent and support was helpful.',
        overallRating: 5,
        reviewType: ReviewType.MATCHMAKING,
      });

      expect(result.status).toBe(ReviewStatus.PENDING);
      expect(result.sentiment).toBe(ReviewSentiment.POSITIVE);
      expect(sentiment.analyzeReview).toHaveBeenCalled();
      expect(audit.emit).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: 'REVIEW_CREATED' }),
      );
    });
  });

  describe('update (BR2)', () => {
    it('allows editing a PENDING review owned by the user', async () => {
      reviewRepo.findById.mockResolvedValue({
        id: 'r1', userId: 'u1', status: ReviewStatus.PENDING,
        title: 'old', reviewText: 'old text here for the review', overallRating: 3,
      });
      const result = await service.update('u1', 'r1', { title: 'new title' });
      expect(result.title).toBe('new title');
      expect(audit.emit).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'REVIEW_UPDATED' }));
    });

    it('rejects editing an APPROVED review', async () => {
      reviewRepo.findById.mockResolvedValue({ id: 'r1', userId: 'u1', status: ReviewStatus.APPROVED });
      await expect(service.update('u1', 'r1', { title: 'x' })).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('rejects editing a review the user does not own', async () => {
      reviewRepo.findById.mockResolvedValue({ id: 'r1', userId: 'someone-else', status: ReviewStatus.PENDING });
      await expect(service.update('u1', 'r1', { title: 'x' })).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('throws NotFound when the review is missing', async () => {
      reviewRepo.findById.mockResolvedValue(null);
      await expect(service.update('u1', 'missing', { title: 'x' })).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('getPublicDetail', () => {
    it('404s for a non-approved review', async () => {
      reviewRepo.findById.mockResolvedValue({ id: 'r1', status: ReviewStatus.PENDING });
      await expect(service.getPublicDetail('r1')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('returns detail with a nested reply tree for an approved review', async () => {
      reviewRepo.findById.mockResolvedValue({ id: 'r1', userId: 'u1', status: ReviewStatus.APPROVED, likeCount: 2 });
      replyRepo.findByReview.mockResolvedValue([
        { id: 'a', parentReplyId: null },
        { id: 'b', parentReplyId: 'a' },
      ]);
      const detail = await service.getPublicDetail('r1', 'viewer');
      expect(detail.replies).toHaveLength(1);
      expect(detail.replies[0].children).toHaveLength(1);
      expect(detail.replies[0].children[0].id).toBe('b');
    });
  });
});
