import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { DiscoveryOwnershipService } from './discovery-ownership.service';
import {
  ClaimStatus, ListingStatus, ManagementType, ProviderMemberRole, ProviderVerificationStatus,
} from '../constants/discovery.enums';
import { AuditEventType } from '../../audit/enums/audit-event-type.enum';
import { buildProviderSearchSql } from '../search/provider-search.query';
import { DiscoverySort } from '../constants/discovery.enums';

describe('DiscoveryOwnershipService', () => {
  let providerRepo: any;
  let memberRepo: any;
  let claimRepo: any;
  let dataSource: any;
  let manager: any;
  let audit: { emit: jest.Mock };
  let svc: DiscoveryOwnershipService;
  let listing: any;

  beforeEach(() => {
    listing = {
      id: 'p1', displayName: 'Iyer Jyothisha', isActive: true, listingStatus: ListingStatus.PUBLISHED,
      managementType: ManagementType.ADMIN_MANAGED, userId: null, verificationStatus: ProviderVerificationStatus.VERIFIED,
    };
    providerRepo = {
      findOne: jest.fn(async () => listing),
      find: jest.fn(async () => [listing]),
      save: jest.fn(async (x) => x),
    };
    memberRepo = { findOne: jest.fn().mockResolvedValue(null), find: jest.fn().mockResolvedValue([]) };
    claimRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      find: jest.fn().mockResolvedValue([]),
      findOneOrFail: jest.fn(async () => ({ id: 'c1', providerId: 'p1', status: ClaimStatus.APPROVED })),
      create: jest.fn((x) => x),
      save: jest.fn(async (x) => ({ id: 'c1', createdAt: new Date(), ...x })),
    };
    const qb = { update: jest.fn().mockReturnThis(), set: jest.fn().mockReturnThis(), where: jest.fn().mockReturnThis(), execute: jest.fn() };
    const memberWrite = { findOne: jest.fn().mockResolvedValue(null), create: jest.fn((x) => x), save: jest.fn(), update: jest.fn() };
    manager = {
      update: jest.fn(), delete: jest.fn(),
      findOne: jest.fn(async () => listing),
      getRepository: jest.fn(() => memberWrite),
      createQueryBuilder: jest.fn(() => qb),
      memberWrite, qb,
    };
    dataSource = { transaction: jest.fn(async (fn) => fn(manager)), query: jest.fn().mockResolvedValue([]) };
    audit = { emit: jest.fn() };
    svc = new DiscoveryOwnershipService(dataSource, providerRepo, memberRepo, claimRepo, audit as any);
  });

  describe('permissions', () => {
    it('only members of a listing may manage it (IDOR)', async () => {
      await expect(svc.assertCanManage('u2', 'p1')).rejects.toBeInstanceOf(ForbiddenException);
      memberRepo.findOne.mockResolvedValue({ providerId: 'p1', userId: 'u1', role: ProviderMemberRole.OWNER });
      await expect(svc.assertCanManage('u1', 'p1')).resolves.toMatchObject({ role: 'OWNER' });
    });
  });

  describe('claims', () => {
    const dto = { providerId: 'p1', message: 'I am the owner of this astrology centre since 2004.' };

    it('a provider can request ownership of an admin-created listing; nothing changes until approval', async () => {
      const c = await svc.createClaim('u1', dto);
      expect(c.status).toBe(ClaimStatus.PENDING);
      expect(manager.update).not.toHaveBeenCalled();
      expect(audit.emit).toHaveBeenCalledWith(expect.objectContaining({ eventType: AuditEventType.DISCOVERY_CLAIM_SUBMITTED }));
    });

    it('cannot claim a provider-managed or already-owned listing', async () => {
      listing.managementType = ManagementType.PROVIDER_MANAGED;
      await expect(svc.createClaim('u1', dto)).rejects.toBeInstanceOf(ConflictException);
      listing.managementType = ManagementType.ADMIN_MANAGED;
      listing.userId = 'someone';
      await expect(svc.createClaim('u1', dto)).rejects.toBeInstanceOf(ConflictException);
    });

    it('cannot claim an unpublished listing, or claim twice', async () => {
      listing.listingStatus = ListingStatus.DRAFT;
      await expect(svc.createClaim('u1', dto)).rejects.toBeInstanceOf(NotFoundException);
      listing.listingStatus = ListingStatus.PUBLISHED;
      claimRepo.findOne.mockResolvedValue({ id: 'c0', status: ClaimStatus.PENDING });
      await expect(svc.createClaim('u1', dto)).rejects.toBeInstanceOf(ConflictException);
    });

    it('approval makes the claimant OWNER, the listing PROVIDER_MANAGED, and rejects competing claims', async () => {
      claimRepo.findOne.mockResolvedValue({ id: 'c1', providerId: 'p1', userId: 'u1', status: ClaimStatus.PENDING });
      await svc.decideClaim('c1', { status: ClaimStatus.APPROVED }, 'admin1');
      expect(manager.memberWrite.save).toHaveBeenCalledWith(expect.objectContaining({ providerId: 'p1', userId: 'u1', role: 'OWNER' }));
      expect(manager.update).toHaveBeenCalledWith(expect.anything(), { id: 'p1' }, { managementType: 'PROVIDER_MANAGED', userId: 'u1' });
      expect(manager.qb.set).toHaveBeenCalledWith(expect.objectContaining({ status: ClaimStatus.REJECTED }));
      expect(audit.emit).toHaveBeenCalledWith(expect.objectContaining({ eventType: AuditEventType.DISCOVERY_CLAIM_DECIDED, userId: 'admin1' }));
    });

    it('rejection needs a note and leaves the listing untouched', async () => {
      claimRepo.findOne.mockResolvedValue({ id: 'c1', providerId: 'p1', userId: 'u1', status: ClaimStatus.PENDING });
      await expect(svc.decideClaim('c1', { status: ClaimStatus.REJECTED }, 'a')).rejects.toBeInstanceOf(BadRequestException);
      await svc.decideClaim('c1', { status: ClaimStatus.REJECTED, note: 'Could not verify ownership' }, 'a');
      expect(manager.memberWrite.save).not.toHaveBeenCalled();
      expect(manager.update).toHaveBeenCalledTimes(1); // only the claim row
    });

    it('a decided claim cannot be decided again', async () => {
      claimRepo.findOne.mockResolvedValue({ id: 'c1', providerId: 'p1', userId: 'u1', status: ClaimStatus.APPROVED });
      await expect(svc.decideClaim('c1', { status: ClaimStatus.REJECTED, note: 'x' }, 'a')).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('admin control', () => {
    it('take-over revokes every provider membership and returns the listing to ADMIN_MANAGED', async () => {
      listing.managementType = ManagementType.PROVIDER_MANAGED;
      listing.userId = 'u1';
      await svc.setManagement('p1', { managementType: ManagementType.ADMIN_MANAGED }, 'admin1');
      expect(manager.delete).toHaveBeenCalledWith(expect.anything(), { providerId: 'p1' });
      expect(manager.update).toHaveBeenCalledWith(expect.anything(), { id: 'p1' }, { managementType: 'ADMIN_MANAGED', userId: null });
    });

    it('assigning requires a verified account', async () => {
      await expect(svc.setManagement('p1', { managementType: ManagementType.PROVIDER_MANAGED }, 'a')).rejects.toBeInstanceOf(BadRequestException);
      dataSource.query.mockResolvedValueOnce([]);
      await expect(svc.setManagement('p1', { managementType: ManagementType.PROVIDER_MANAGED, ownerEmail: 'x@y.z' }, 'a'))
        .rejects.toBeInstanceOf(NotFoundException);
      dataSource.query.mockResolvedValueOnce([{ id: 'u9', email: 'x@y.z', is_active: 1, is_email_verified: 0, is_deleted: 0 }]);
      await expect(svc.setManagement('p1', { managementType: ManagementType.PROVIDER_MANAGED, ownerEmail: 'x@y.z' }, 'a'))
        .rejects.toBeInstanceOf(BadRequestException);
    });

    it.each([
      ['PUBLISH', undefined, ListingStatus.PUBLISHED],
      ['REQUEST_CHANGES', 'Add your address', ListingStatus.CHANGES_REQUESTED],
    ] as const)('review %s → %s', async (decision, note, status) => {
      listing.listingStatus = ListingStatus.SUBMITTED;
      await svc.reviewSubmission('p1', { decision, note }, 'admin1');
      expect(providerRepo.save).toHaveBeenCalledWith(expect.objectContaining({ listingStatus: status }));
    });

    it('REQUEST_CHANGES / REJECT need a note; REJECT also rejects verification', async () => {
      await expect(svc.reviewSubmission('p1', { decision: 'REQUEST_CHANGES' }, 'a')).rejects.toBeInstanceOf(BadRequestException);
      await svc.reviewSubmission('p1', { decision: 'REJECT', note: 'Not a wedding business' }, 'a');
      expect(providerRepo.save).toHaveBeenCalledWith(expect.objectContaining({
        verificationStatus: ProviderVerificationStatus.REJECTED, reviewNote: 'Not a wedding business',
      }));
    });
  });

  it('public search only returns PUBLISHED listings', () => {
    const { page } = buildProviderSearchSql({
      categoryId: 1, origin: null, radiusKm: null, country: null, state: null, city: null, languages: [],
      consultationModes: [], minRating: null, minPrice: null, maxPrice: null, verifiedOnly: false, q: null,
      sort: DiscoverySort.RECOMMENDED, page: 1, limit: 10,
      category: { joins: [], joinParams: [], where: [], whereParams: [], experienceExpr: null },
    });
    expect(page.sql).toContain('p.listing_status = ?');
    expect(page.params).toContain(ListingStatus.PUBLISHED);
  });
});
