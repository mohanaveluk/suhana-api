import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { randomInt } from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import {
  AccountType, ClaimStatus, ListingStatus, ManagementType, ProviderMemberRole,
} from '../constants/discovery.enums';
import { DISCOVERY_COUNTRIES } from '../constants/discovery.constants';
import { DiscoveryProvider } from '../entities/discovery-provider.entity';
import { DiscoveryLocation } from '../entities/discovery-location.entity';
import { DiscoveryService } from '../entities/discovery-service.entity';
import { DiscoveryProviderMedia } from '../entities/discovery-provider-media.entity';
import { DiscoveryCategory } from '../entities/discovery-category.entity';
import {
  CategoryDetailInputDto, CertificationInputDto, CreateProviderDto, GeocodeQueryDto, LocationInputDto, UpdateLocationDto,
  UpdateProviderDto,
} from '../dto/discovery-admin.dto';
import { ClaimableQueryDto, CreateClaimDto, ProviderRegisterDto } from '../dto/discovery-provider-portal.dto';
import { AdminProviderDto, DiscoveryAdminService } from './discovery-admin.service';
import { DiscoveryCatalogService } from './discovery-catalog.service';
import { DiscoveryOwnershipService } from './discovery-ownership.service';
import { User } from '../../user/entity/user.entity';
import { RoleEntity } from '../../user/entity/roles.entity';
import { EmailService } from 'src/shared/email/email.service';
import { verifyEmailTemplate } from 'src/shared/email/templates/verify-email-template';
import { EmailType } from '../../email-history/entity/email-history.entity';
import { AuditEmitter } from '../../audit/audit.emitter';
import { AuditEventType } from '../../audit/enums/audit-event-type.enum';
import { AuditEntityType } from '../../audit/enums/audit-entity-type.enum';

/** What the provider sees about their listing (admin-internal fields removed). */
export type ProviderListingDto = Omit<AdminProviderDto, 'verificationNotes' | 'owners'> & {
  myRole: ProviderMemberRole;
  checklist: ListingChecklist;
};

export interface ListingChecklist {
  category: boolean;
  location: boolean;
  about: boolean;
  service: boolean;
  photo: boolean;
  contact: boolean;
  /** Required items done → can submit for review. */
  readyToSubmit: boolean;
  /** 0–100, for the progress bar. */
  percent: number;
}

export interface ProviderListingSummary {
  id: string;
  displayName: string;
  businessName: string | null;
  categorySlugs: string[];
  primaryPlace: string | null;
  photoUrl: string | null;
  listingStatus: ListingStatus;
  verificationStatus: string;
  managementType: ManagementType;
  reviewNote: string | null;
  myRole: ProviderMemberRole;
  ratingAvg: number | null;
  ratingCount: number;
  checklist: ListingChecklist;
  updatedAt: Date;
}

const EDITABLE_STATUSES = [ListingStatus.DRAFT, ListingStatus.CHANGES_REQUESTED];

/**
 * Aurora Discover "For Providers" self-service. Accounts live in the shared
 * `user` table (same login / JWT as members). Listing edits reuse
 * DiscoveryAdminService, behind DiscoveryOwnershipService.assertCanManage and
 * provider-safe field restrictions (no self-verification, no visibility
 * toggles, photo must be one of the listing's own uploads).
 */
@Injectable()
export class ProviderPortalService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(DiscoveryProvider) private readonly providerRepo: Repository<DiscoveryProvider>,
    @InjectRepository(DiscoveryProviderMedia) private readonly mediaRepo: Repository<DiscoveryProviderMedia>,
    @InjectRepository(DiscoveryCategory) private readonly categoryRepo: Repository<DiscoveryCategory>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(RoleEntity) private readonly roleRepo: Repository<RoleEntity>,
    private readonly admin: DiscoveryAdminService,
    private readonly catalog: DiscoveryCatalogService,
    private readonly ownership: DiscoveryOwnershipService,
    private readonly email: EmailService,
    private readonly auditEmitter: AuditEmitter,
  ) {}

  // ── Registration ────────────────────────────────────────────────────────

  /**
   * Creates a PROVIDER account (unverified) and a DRAFT listing it owns, then
   * emails a verification link to {frontend}/providers/auth/verifyemail/... .
   * Existing accounts (members included) sign in instead and add a business.
   */
  async register(dto: ProviderRegisterDto, frontendBase: string): Promise<{ message: string; email: string }> {
    const [category] = await this.catalog.findBySlugs([dto.categorySlug]);
    if (!category) throw new BadRequestException('Choose a valid business category.');

    const existing = await this.userRepo.findOne({ where: { email: dto.email }, select: { id: true, is_email_verified: true, is_deleted: true } });
    if (existing && !existing.is_deleted) {
      throw new ConflictException(
        existing.is_email_verified
          ? 'An Aurora account already uses this email. Sign in to add your business to it.'
          : 'This email is registered but not verified yet. Check your inbox for the verification email.',
      );
    }

    const role = (await this.roleRepo.findOne({ where: { name: 'registered' } }))
      ?? (await this.roleRepo.findOne({ where: { name: 'user' } }));
    if (!role) throw new BadRequestException('Registration is not available right now.');

    const code = String(randomInt(100000, 1000000));
    const now = new Date();
    const user = await this.userRepo.save(this.userRepo.create({
      id: uuidv4(),
      first_name: dto.firstName,
      last_name: dto.lastName ?? null,
      email: dto.email,
      password: await bcrypt.hash(dto.password, 10),
      mobile: dto.mobile,
      gender: null,
      account_type: AccountType.PROVIDER,
      role_id: role.id,
      country: DISCOVERY_COUNTRIES[dto.country]?.name ?? dto.country,
      created_at: now,
      created_at_utc: now,
      verification_code: code,
      verification_code_expiry: new Date(Date.now() + 30 * 60 * 1000),
      is_email_verified: false,
      is_active: 0,
    } as Partial<User>));

    // Draft listing owned by the new account (not visible until submitted + approved).
    const listing = await this.admin.create({
      displayName: dto.businessName,
      businessName: dto.businessName,
      categorySlugs: [category.slug],
      phone: dto.mobile,
      email: dto.email,
      locations: [],
    } as CreateProviderDto, user.id);
    await this.dataSource.transaction(async (m) => {
      await m.update(DiscoveryProvider, { id: listing.id }, {
        listingStatus: ListingStatus.DRAFT,
        managementType: ManagementType.PROVIDER_MANAGED,
        userId: user.id,
        createdBy: user.id,
      });
      await this.ownership.addMember(m, listing.id, user.id, ProviderMemberRole.OWNER, user.id);
    });

    await this.email.sendEmail({
      to: user.email,
      subject: 'Aurora Discover - Verify your business account',
      html: verifyEmailTemplate(code, user.id, dto.firstName, `${frontendBase}/providers`),
      history: { emailType: EmailType.EMAIL_VERIFICATION, fromUserId: user.id, toUserId: user.id, createdBy: user.id },
    });
    this.auditEmitter.emit({
      eventType: AuditEventType.DISCOVERY_PROVIDER_ACCOUNT_CREATED,
      entityType: AuditEntityType.DISCOVERY_PROVIDER,
      entityId: listing.id,
      userId: user.id,
      newValue: { businessName: dto.businessName, category: category.slug, country: dto.country },
      description: 'Provider account registered via For Providers',
    });
    return { message: 'Account created. Check your email for a verification link.', email: user.email };
  }

  // ── Dashboard ───────────────────────────────────────────────────────────

  async me(userId: string) {
    const user = await this.userRepo.findOne({
      where: { id: userId },
      select: { id: true, first_name: true, last_name: true, email: true, account_type: true, mobile: true },
    });
    const memberships = await this.ownership.membershipsOf(userId);
    const listings = await this.summaries(memberships.map((m) => m.providerId), new Map(memberships.map((m) => [m.providerId, m.role])));
    const claims = await this.ownership.myClaims(userId);
    return {
      user: {
        id: user?.id ?? userId,
        firstName: user?.first_name ?? '',
        lastName: user?.last_name ?? null,
        email: user?.email ?? '',
        accountType: user?.account_type ?? AccountType.MEMBER,
      },
      listings,
      claims,
    };
  }

  private async summaries(ids: string[], roles: Map<string, ProviderMemberRole>): Promise<ProviderListingSummary[]> {
    if (!ids.length) return [];
    const rows = await this.providerRepo.find({
      where: { id: In(ids) },
      relations: { locations: true, services: true, categories: { category: true } },
      order: { updatedAt: 'DESC' },
    });
    const media = await this.mediaRepo.find({ where: { providerId: In(ids) }, select: { providerId: true } });
    const withMedia = new Set(media.map((m) => m.providerId));
    return rows.map((p) => {
      const locs = (p.locations ?? []).filter((l) => l.isActive);
      const primary = locs.find((l) => l.isPrimary) ?? locs[0];
      return {
        id: p.id,
        displayName: p.displayName,
        businessName: p.businessName,
        categorySlugs: (p.categories ?? []).sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary)).map((c) => c.category?.slug).filter(Boolean),
        primaryPlace: primary ? [primary.city, primary.state, primary.country].filter(Boolean).join(', ') : null,
        photoUrl: p.photoUrl,
        listingStatus: p.listingStatus,
        verificationStatus: p.verificationStatus,
        managementType: p.managementType,
        reviewNote: p.reviewNote,
        myRole: roles.get(p.id) ?? ProviderMemberRole.STAFF,
        ratingAvg: p.ratingAvg,
        ratingCount: p.ratingCount,
        checklist: this.checklist(p, locs.length, (p.services ?? []).filter((s) => s.isActive).length, withMedia.has(p.id) || !!p.photoUrl),
        updatedAt: p.updatedAt,
      };
    });
  }

  private checklist(p: DiscoveryProvider, locations: number, services: number, photo: boolean): ListingChecklist {
    const c = {
      category: (p.categories ?? []).length > 0,
      location: locations > 0,
      about: !!p.about && p.about.trim().length >= 40,
      service: services > 0,
      photo,
      contact: !!(p.phone || p.email || p.website),
    };
    const done = Object.values(c).filter(Boolean).length;
    return { ...c, readyToSubmit: c.category && c.location && c.about && c.contact, percent: Math.round((done / 6) * 100) };
  }

  // ── Listings ────────────────────────────────────────────────────────────

  async getListing(userId: string, id: string): Promise<ProviderListingDto> {
    const member = await this.ownership.assertCanManage(userId, id);
    return this.toProviderView(await this.admin.get(id), member.role);
  }

  private async toProviderView(a: AdminProviderDto, role: ProviderMemberRole): Promise<ProviderListingDto> {
    const { verificationNotes: _notes, owners: _owners, ...rest } = a;
    const p = await this.providerRepo.findOne({
      where: { id: a.id }, relations: { categories: true },
    });
    const activeLocs = a.locations.filter((l) => l.isActive).length;
    const activeServices = a.services.filter((s) => s.isActive !== false).length;
    return {
      ...rest,
      myRole: role,
      checklist: this.checklist(p ?? ({ categories: [] } as unknown as DiscoveryProvider), activeLocs, activeServices, a.media.length > 0 || !!a.photoUrl),
    };
  }

  /** A provider adding another business: new DRAFT listing they own. */
  async createListing(userId: string, dto: CreateProviderDto): Promise<ProviderListingDto> {
    const safe = await this.sanitize(null, dto) as CreateProviderDto;
    const created = await this.admin.create({ ...safe, isActive: true }, userId);
    await this.dataSource.transaction(async (m) => {
      await m.update(DiscoveryProvider, { id: created.id }, {
        listingStatus: ListingStatus.DRAFT, managementType: ManagementType.PROVIDER_MANAGED, userId, createdBy: userId,
      });
      await this.ownership.addMember(m, created.id, userId, ProviderMemberRole.OWNER, userId);
    });
    return this.getListing(userId, created.id);
  }

  async updateListing(userId: string, id: string, dto: UpdateProviderDto): Promise<ProviderListingDto> {
    const member = await this.ownership.assertCanManage(userId, id);
    const safe = await this.sanitize(id, dto) as UpdateProviderDto;
    return this.toProviderView(await this.admin.update(id, safe, userId), member.role);
  }

  /**
   * Fields a provider may not set: isActive (admin visibility switch),
   * certification `verified` (only admins verify credentials — previously
   * verified entries that are unchanged keep their flag), and a photo URL that
   * isn't one of the listing's own uploads.
   */
  private async sanitize(id: string | null, dto: CreateProviderDto | UpdateProviderDto): Promise<CreateProviderDto | UpdateProviderDto> {
    const { isActive: _ignored, ...rest } = dto as CreateProviderDto & UpdateProviderDto;
    const out = { ...rest } as CreateProviderDto & UpdateProviderDto;

    if (out.photoUrl !== undefined && out.photoUrl !== null) {
      const own = id ? await this.mediaRepo.findOne({ where: { providerId: id, url: out.photoUrl } }) : null;
      if (!own) throw new BadRequestException('Upload the photo to your listing first, then choose it as the listing photo.');
    }

    const current = id ? await this.admin.get(id) : null;
    const key = (c: { name: string; issuer?: string | null; year?: number | null }) =>
      `${c.name.trim().toLowerCase()}|${(c.issuer ?? '').trim().toLowerCase()}|${c.year ?? ''}`;
    const keepVerified = (incoming: CertificationInputDto[] | undefined, existing: { name: string; issuer?: string | null; year?: number | null; verified?: boolean }[] | undefined) => {
      if (!incoming) return incoming;
      const verified = new Set((existing ?? []).filter((c) => c.verified).map(key));
      return incoming.map((c) => ({ ...c, verified: verified.has(key(c)) }));
    };
    if (out.astrologer?.certifications) {
      out.astrologer = { ...out.astrologer, certifications: keepVerified(out.astrologer.certifications, current?.astrologer?.certifications) };
    }
    if (out.categoryDetails) {
      out.categoryDetails = out.categoryDetails.map((d: CategoryDetailInputDto) => ({
        ...d,
        certifications: keepVerified(d.certifications, current?.categoryDetails?.find((c) => c.categorySlug === d.categorySlug)?.certifications),
      }));
    }
    return out;
  }

  /** DRAFT / CHANGES_REQUESTED → SUBMITTED, once required items are complete. */
  async submit(userId: string, id: string): Promise<ProviderListingDto> {
    const member = await this.ownership.assertCanManage(userId, id);
    const view = await this.getListing(userId, id);
    if (!EDITABLE_STATUSES.includes(view.listingStatus as ListingStatus)) {
      throw new BadRequestException(
        view.listingStatus === ListingStatus.SUBMITTED ? 'This listing is already waiting for review.' : 'This listing is already published.',
      );
    }
    if (!view.checklist.readyToSubmit) {
      throw new BadRequestException('Add a category, a location, a description (40+ characters) and a contact method before submitting.');
    }
    await this.providerRepo.update({ id }, { listingStatus: ListingStatus.SUBMITTED, submittedAt: new Date() });
    this.auditEmitter.emit({
      eventType: AuditEventType.DISCOVERY_LISTING_SUBMITTED,
      entityType: AuditEntityType.DISCOVERY_PROVIDER,
      entityId: id,
      userId,
      oldValue: { listingStatus: view.listingStatus },
      newValue: { listingStatus: ListingStatus.SUBMITTED },
      description: 'Provider submitted Discover listing for review',
    });
    return this.toProviderView(await this.admin.get(id), member.role);
  }

  // Locations / media / geocode: ownership check, then the shared admin implementation.
  async addLocation(userId: string, id: string, dto: LocationInputDto) {
    const m = await this.ownership.assertCanManage(userId, id);
    return this.toProviderView(await this.admin.addLocation(id, dto, userId), m.role);
  }

  async updateLocation(userId: string, id: string, locationId: string, dto: UpdateLocationDto) {
    const m = await this.ownership.assertCanManage(userId, id);
    return this.toProviderView(await this.admin.updateLocation(id, locationId, dto, userId), m.role);
  }

  async deleteLocation(userId: string, id: string, locationId: string) {
    const m = await this.ownership.assertCanManage(userId, id);
    return this.toProviderView(await this.admin.deleteLocation(id, locationId, userId), m.role);
  }

  async uploadMedia(userId: string, id: string, file: Express.Multer.File | undefined, caption: string | null, setAsPhoto: boolean) {
    const m = await this.ownership.assertCanManage(userId, id);
    return this.toProviderView(await this.admin.uploadMedia(id, file, caption, setAsPhoto, userId), m.role);
  }

  async deleteMedia(userId: string, id: string, mediaId: string) {
    const m = await this.ownership.assertCanManage(userId, id);
    return this.toProviderView(await this.admin.deleteMedia(id, mediaId, userId), m.role);
  }

  geocode(q: GeocodeQueryDto) {
    return this.admin.geocode(q);
  }

  // ── Claims ──────────────────────────────────────────────────────────────

  /** Published, admin-managed, unowned listings matching a name — candidates for "Claim this business". */
  async claimable(userId: string, q: ClaimableQueryDto) {
    const like = `%${q.q.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
    const qb = this.providerRepo.createQueryBuilder('p')
      .leftJoinAndSelect('p.locations', 'l')
      .leftJoinAndSelect('p.categories', 'pc')
      .leftJoinAndSelect('pc.category', 'c')
      .where('p.is_active = 1')
      .andWhere('p.listing_status = :pub', { pub: ListingStatus.PUBLISHED })
      .andWhere('p.management_type = :adm', { adm: ManagementType.ADMIN_MANAGED })
      .andWhere('p.user_id IS NULL')
      .andWhere('(p.display_name LIKE :like OR p.business_name LIKE :like)', { like })
      // Property name (not column): TypeORM paginates joined queries with a sub-select.
      .orderBy('p.displayName', 'ASC')
      .take(20);
    if (q.category) qb.andWhere('c.slug = :cat', { cat: q.category });
    const rows = await qb.getMany();
    const mine = await this.ownership.myClaims(userId);
    const pending = new Set(mine.filter((c) => c.status === ClaimStatus.PENDING).map((c) => c.providerId));
    return rows.map((p) => {
      const loc = (p.locations ?? []).find((l) => l.isPrimary) ?? p.locations?.[0];
      return {
        id: p.id,
        displayName: p.displayName,
        businessName: p.businessName,
        place: loc ? [loc.city, loc.state, loc.country].filter(Boolean).join(', ') : null,
        categorySlugs: (p.categories ?? []).map((pc) => pc.category?.slug).filter(Boolean),
        photoUrl: p.photoUrl,
        myPendingClaim: pending.has(p.id),
      };
    });
  }

  createClaim(userId: string, dto: CreateClaimDto) {
    return this.ownership.createClaim(userId, dto);
  }

  cancelClaim(userId: string, claimId: string) {
    return this.ownership.cancelClaim(userId, claimId);
  }
}
