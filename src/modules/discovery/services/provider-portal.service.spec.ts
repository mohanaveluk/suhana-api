import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { ProviderPortalService } from './provider-portal.service';
import { ListingStatus, ManagementType, ProviderMemberRole } from '../constants/discovery.enums';

const adminView = (over: any = {}) => ({
  id: 'p1', displayName: 'Shaandaar Events', verificationNotes: 'internal', owners: [],
  locations: [{ isActive: true }], services: [], media: [], photoUrl: null,
  listingStatus: ListingStatus.DRAFT, managementType: ManagementType.PROVIDER_MANAGED,
  astrologer: { certifications: [{ name: 'Jyotisha Visharada', issuer: 'X', year: 2004, verified: true }] },
  categoryDetails: [], ...over,
});

describe('ProviderPortalService', () => {
  let admin: any;
  let ownership: any;
  let providerRepo: any;
  let mediaRepo: any;
  let userRepo: any;
  let svc: ProviderPortalService;

  beforeEach(() => {
    admin = {
      get: jest.fn(async () => adminView()),
      update: jest.fn(async () => adminView()),
      create: jest.fn(async () => ({ id: 'new' })),
    };
    ownership = {
      assertCanManage: jest.fn().mockResolvedValue({ providerId: 'p1', userId: 'u1', role: ProviderMemberRole.OWNER }),
      addMember: jest.fn(),
    };
    providerRepo = {
      findOne: jest.fn(async () => ({ id: 'p1', categories: [{}], about: 'x'.repeat(50), phone: '+1 555 0100' })),
      update: jest.fn(),
    };
    mediaRepo = { findOne: jest.fn().mockResolvedValue(null) };
    userRepo = { findOne: jest.fn().mockResolvedValue(null) };
    svc = new ProviderPortalService(
      { transaction: jest.fn(async (fn) => fn({ update: jest.fn() })) } as any,
      providerRepo, mediaRepo, {} as any, userRepo, { findOne: jest.fn() } as any,
      admin, { findBySlugs: jest.fn().mockResolvedValue([{ slug: 'wedding-planner' }]) } as any,
      ownership, { sendEmail: jest.fn() } as any, { emit: jest.fn() } as any,
    );
  });

  it('a provider can only edit listings they manage', async () => {
    ownership.assertCanManage.mockRejectedValue(new ForbiddenException());
    await expect(svc.updateListing('u2', 'p1', { displayName: 'Hijack' })).rejects.toBeInstanceOf(ForbiddenException);
    expect(admin.update).not.toHaveBeenCalled();
  });

  it('providers cannot toggle admin visibility or self-verify credentials', async () => {
    await svc.updateListing('u1', 'p1', {
      isActive: false,
      astrologer: { certifications: [
        { name: 'Jyotisha Visharada', issuer: 'X', year: 2004, verified: true }, // already verified → kept
        { name: 'New certificate', verified: true },                            // provider can't verify
      ] },
    } as any);
    const sent = admin.update.mock.calls[0][1];
    expect(sent).not.toHaveProperty('isActive');
    expect(sent.astrologer.certifications.map((c: any) => c.verified)).toEqual([true, false]);
  });

  it('listing photo must be one of the listing’s own uploads', async () => {
    await expect(svc.updateListing('u1', 'p1', { photoUrl: 'https://evil.example/x.jpg' })).rejects.toBeInstanceOf(BadRequestException);
    mediaRepo.findOne.mockResolvedValue({ id: 'm1' });
    await expect(svc.updateListing('u1', 'p1', { photoUrl: 'https://storage.googleapis.com/b/discovery/p1.jpg' })).resolves.toBeDefined();
  });

  it('provider view hides admin-internal notes and owners', async () => {
    const v = await svc.getListing('u1', 'p1');
    expect(v).not.toHaveProperty('verificationNotes');
    expect(v).not.toHaveProperty('owners');
    expect(v.myRole).toBe('OWNER');
  });

  it('submit moves a complete draft to SUBMITTED', async () => {
    await svc.submit('u1', 'p1');
    expect(providerRepo.update).toHaveBeenCalledWith({ id: 'p1' }, expect.objectContaining({ listingStatus: ListingStatus.SUBMITTED }));
  });

  it('submit is refused for incomplete or already-submitted listings', async () => {
    providerRepo.findOne.mockResolvedValue({ id: 'p1', categories: [{}], about: '', phone: null });
    await expect(svc.submit('u1', 'p1')).rejects.toBeInstanceOf(BadRequestException);
    admin.get.mockResolvedValue(adminView({ listingStatus: ListingStatus.SUBMITTED }));
    await expect(svc.submit('u1', 'p1')).rejects.toThrow(/already waiting/);
  });

  it('a new business added by a provider is a DRAFT they own', async () => {
    await svc.createListing('u1', { displayName: 'Second Studio', categorySlugs: ['photography'] } as any);
    expect(admin.create).toHaveBeenCalledWith(expect.objectContaining({ displayName: 'Second Studio' }), 'u1');
    expect(ownership.addMember).toHaveBeenCalledWith(expect.anything(), 'new', 'u1', 'OWNER', 'u1');
  });

  const registration = {
    businessName: 'B', firstName: 'A', email: 'a@b.c', mobile: '+1 555 0100', password: 'abc12345',
    categorySlug: 'wedding-planner', country: 'US',
  };

  // ── One Aurora identity: no duplicate accounts ───────────────────────────
  it('registration with an existing email never creates a second account — sign in to continue', async () => {
    userRepo.findOne.mockResolvedValue({ id: 'u5', is_email_verified: true, is_deleted: false });
    userRepo.save = jest.fn();
    userRepo.create = jest.fn();
    const err = await svc.register(registration, 'http://localhost:4300').catch((e) => e);
    expect(err).toBeInstanceOf(ConflictException);
    expect(err.getResponse()).toMatchObject({
      code: 'ACCOUNT_EXISTS',
      message: 'An Aurora account already exists with this email address. Please sign in to continue registering your business.',
    });
    expect(userRepo.create).not.toHaveBeenCalled();
    expect(userRepo.save).not.toHaveBeenCalled();
    expect(admin.create).not.toHaveBeenCalled();
  });

  it('an existing unverified email is pointed at verification, not duplicated', async () => {
    userRepo.findOne.mockResolvedValue({ id: 'u6', is_email_verified: false, is_deleted: false });
    userRepo.save = jest.fn();
    const err = await svc.register(registration, 'http://localhost:4300').catch((e) => e);
    expect(err.getResponse()).toMatchObject({ code: 'ACCOUNT_NOT_VERIFIED' });
    expect(userRepo.save).not.toHaveBeenCalled();
  });

  it('a signed-in member registering a business reuses their account and becomes its owner (→ PROVIDER)', async () => {
    userRepo.findOne.mockResolvedValue({ id: 'm1', email: 'm@x.com', mobile: '+91 98400 12345', is_email_verified: true, is_active: 1 });
    userRepo.save = jest.fn();
    userRepo.create = jest.fn();
    const res = await svc.onboard('m1', { businessName: 'Lotus Hall', categorySlug: 'wedding-planner', country: 'IN' });
    expect(res.listingId).toBe('new');
    expect(userRepo.create).not.toHaveBeenCalled(); // no new user
    expect(userRepo.save).not.toHaveBeenCalled();
    expect(admin.create).toHaveBeenCalledWith(expect.objectContaining({ displayName: 'Lotus Hall', email: 'm@x.com' }), 'm1');
    // Owning the listing is what grants PROVIDER (DiscoveryOwnershipService.addMember).
    expect(ownership.addMember).toHaveBeenCalledWith(expect.anything(), 'new', 'm1', ProviderMemberRole.OWNER, 'm1');
  });

  it('onboarding is refused for an unverified account', async () => {
    userRepo.findOne.mockResolvedValue({ id: 'm2', is_email_verified: false });
    await expect(svc.onboard('m2', { businessName: 'X', categorySlug: 'wedding-planner', country: 'IN' }))
      .rejects.toBeInstanceOf(ForbiddenException);
    expect(admin.create).not.toHaveBeenCalled();
  });
});
