import { ConflictException, NotFoundException } from '@nestjs/common';
import { DiscoveryReviewsService } from './discovery-reviews.service';
import { DiscoveryReviewStatus } from '../constants/discovery.enums';
import { AuditEventType } from '../../audit/enums/audit-event-type.enum';

describe('DiscoveryReviewsService', () => {
  let reviewRepo: any;
  let providerRepo: any;
  let dataSource: { query: jest.Mock };
  let search: { findVisibleProvider: jest.Mock };
  let audit: { emit: jest.Mock };
  let svc: DiscoveryReviewsService;
  let qb: any;

  beforeEach(() => {
    qb = {
      select: jest.fn().mockReturnThis(), addSelect: jest.fn().mockReturnThis(), where: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue({ avg: '4.5000', n: '2' }),
    };
    reviewRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      findAndCount: jest.fn().mockResolvedValue([[], 0]),
      create: jest.fn((x) => x),
      save: jest.fn(async (x) => ({ id: 'r1', createdAt: new Date(), ...x })),
      createQueryBuilder: jest.fn(() => qb),
    };
    providerRepo = { update: jest.fn(), find: jest.fn().mockResolvedValue([]) };
    dataSource = { query: jest.fn().mockResolvedValue([{ id: 'u1', first_name: 'Priya', last_name: 'Srinivasan' }]) };
    search = { findVisibleProvider: jest.fn().mockResolvedValue({ id: 'p1', userId: null }) };
    audit = { emit: jest.fn() };
    svc = new DiscoveryReviewsService(reviewRepo, providerRepo, dataSource as any, search as any, audit as any);
  });

  it('new review starts PENDING, shows only first name + initial, and is audited', async () => {
    const r = await svc.create('p1', 'u1', { rating: 5, comment: 'Very thorough horoscope matching session.' });
    expect(r).toMatchObject({ status: DiscoveryReviewStatus.PENDING, authorName: 'Priya S.', isMine: true });
    expect(audit.emit).toHaveBeenCalledWith(expect.objectContaining({ eventType: AuditEventType.DISCOVERY_REVIEW_SUBMITTED }));
  });

  it('one review per member per listing', async () => {
    reviewRepo.findOne.mockResolvedValue({ id: 'r0' });
    await expect(svc.create('p1', 'u1', { rating: 4, comment: 'x'.repeat(30) })).rejects.toBeInstanceOf(ConflictException);
  });

  it('cannot review your own listing', async () => {
    search.findVisibleProvider.mockResolvedValue({ id: 'p1', userId: 'u1' });
    await expect(svc.create('p1', 'u1', { rating: 5, comment: 'x'.repeat(30) })).rejects.toBeInstanceOf(ConflictException);
  });

  it('public list shows APPROVED only', async () => {
    await svc.list('p1', 'u1');
    expect(reviewRepo.findAndCount).toHaveBeenCalledWith(
      expect.objectContaining({ where: { providerId: 'p1', status: DiscoveryReviewStatus.APPROVED } }),
    );
  });

  it('moderation recomputes the rating from APPROVED reviews and is audited', async () => {
    reviewRepo.findOne.mockResolvedValue({ id: 'r1', providerId: 'p1', status: DiscoveryReviewStatus.PENDING });
    await svc.moderate('r1', { status: DiscoveryReviewStatus.APPROVED }, 'admin1');
    expect(qb.where).toHaveBeenCalledWith(expect.any(String), { providerId: 'p1', status: DiscoveryReviewStatus.APPROVED });
    expect(providerRepo.update).toHaveBeenCalledWith({ id: 'p1' }, { ratingCount: 2, ratingAvg: 4.5 });
    expect(audit.emit).toHaveBeenCalledWith(expect.objectContaining({
      eventType: AuditEventType.DISCOVERY_REVIEW_MODERATED, userId: 'admin1',
      oldValue: { status: 'PENDING' },
    }));
  });

  it('no approved reviews → rating cleared (never invented)', async () => {
    qb.getRawOne.mockResolvedValue({ avg: null, n: '0' });
    reviewRepo.findOne.mockResolvedValue({ id: 'r1', providerId: 'p1', status: DiscoveryReviewStatus.APPROVED });
    await svc.moderate('r1', { status: DiscoveryReviewStatus.HIDDEN }, 'admin1');
    expect(providerRepo.update).toHaveBeenCalledWith({ id: 'p1' }, { ratingCount: 0, ratingAvg: null });
  });

  it('moderating an unknown review → 404', async () => {
    await expect(svc.moderate('nope', { status: DiscoveryReviewStatus.APPROVED }, 'a')).rejects.toBeInstanceOf(NotFoundException);
  });
});
