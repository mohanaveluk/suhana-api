import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { AdminReviewsService } from './admin-reviews.service';
import { ReviewStatus } from '../enums/testimonial.enums';

describe('AdminReviewsService', () => {
  let service: AdminReviewsService;
  let reviewRepo: any;
  let audit: any;

  beforeEach(() => {
    reviewRepo = {
      findById: jest.fn(),
      save: jest.fn((x) => Promise.resolve(x)),
    };
    audit = { emit: jest.fn() };
    service = new AdminReviewsService(
      reviewRepo,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      audit,
    );
  });

  describe('approve (BR4)', () => {
    it('approves a review authored by someone else', async () => {
      reviewRepo.findById.mockResolvedValue({ id: 'r1', userId: 'author', status: ReviewStatus.PENDING });
      const result = await service.approve('admin1', 'r1');
      expect(result.status).toBe(ReviewStatus.APPROVED);
      expect(result.approvedBy).toBe('admin1');
      expect(audit.emit).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'REVIEW_APPROVED' }));
    });

    it('forbids an admin approving their own review', async () => {
      reviewRepo.findById.mockResolvedValue({ id: 'r1', userId: 'admin1', status: ReviewStatus.PENDING });
      await expect(service.approve('admin1', 'r1')).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('setFeatured (BR9)', () => {
    it('features an approved review with its order', async () => {
      reviewRepo.findById.mockResolvedValue({ id: 'r1', userId: 'author', status: ReviewStatus.APPROVED });
      const result = await service.setFeatured('admin1', 'r1', { featured: true, featuredOrder: 3 });
      expect(result.isFeatured).toBe(true);
      expect(result.featuredOrder).toBe(3);
    });

    it('refuses to feature a non-approved review', async () => {
      reviewRepo.findById.mockResolvedValue({ id: 'r1', userId: 'author', status: ReviewStatus.PENDING });
      await expect(
        service.setFeatured('admin1', 'r1', { featured: true, featuredOrder: 1 }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});
