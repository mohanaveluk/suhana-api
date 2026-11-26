import {
  BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import {
  ClaimStatus, ListingStatus, ManagementType, ProviderMemberRole, ProviderVerificationStatus,
} from '../constants/discovery.enums';
import { DiscoveryProvider } from '../entities/discovery-provider.entity';
import { DiscoveryProviderMember } from '../entities/discovery-provider-member.entity';
import { DiscoveryListingClaim } from '../entities/discovery-listing-claim.entity';
import {
  AdminClaimQueryDto, CreateClaimDto, DecideClaimDto, ListingOwnerDto, ListingOwnershipDto, ReviewSubmissionDto,
  SetManagementDto,
} from '../dto/discovery-provider-portal.dto';
import { AuditEmitter } from '../../audit/audit.emitter';
import { AuditEventType } from '../../audit/enums/audit-event-type.enum';
import { AuditEntityType } from '../../audit/enums/audit-entity-type.enum';

interface UserRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  is_active?: number;
  is_email_verified?: number;
  is_deleted?: number;
}

export interface ClaimDto {
  id: string;
  providerId: string;
  providerName: string | null;
  status: ClaimStatus;
  message: string | null;
  contactName: string | null;
  contactPhone: string | null;
  businessEmail: string | null;
  adminNote: string | null;
  createdAt: Date;
  reviewedAt: Date | null;
  /** Admin view only. */
  claimant?: { userId: string; name: string; email: string };
  /** Admin view only: listing contact details on file, to compare with the claim. */
  listingContact?: { phone: string | null; email: string | null; website: string | null };
}

/**
 * Listing ownership for Aurora Discover provider self-service:
 * who may manage a listing, "Claim this business" requests, admin review of
 * provider submissions, and admin takeover / assignment.
 *
 * Rules: admins keep full control of every listing (they never need a member
 * row); providers manage only listings they are members of; registering or
 * claiming never grants access without an explicit admin approval (except a
 * listing the provider created themself, which they own from the start).
 */
@Injectable()
export class DiscoveryOwnershipService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(DiscoveryProvider) private readonly providerRepo: Repository<DiscoveryProvider>,
    @InjectRepository(DiscoveryProviderMember) private readonly memberRepo: Repository<DiscoveryProviderMember>,
    @InjectRepository(DiscoveryListingClaim) private readonly claimRepo: Repository<DiscoveryListingClaim>,
    private readonly auditEmitter: AuditEmitter,
  ) {}

  // ── Users ───────────────────────────────────────────────────────────────

  async usersById(ids: string[]): Promise<Map<string, UserRow>> {
    const unique = Array.from(new Set(ids.filter(Boolean)));
    if (!unique.length) return new Map();
    const rows: UserRow[] = await this.dataSource.query(
      `SELECT id, first_name, last_name, email FROM \`user\` WHERE id IN (${unique.map(() => '?').join(', ')})`,
      unique,
    );
    return new Map(rows.map((r) => [r.id, r]));
  }

  private nameOf(u: UserRow | undefined): string {
    return u ? [u.first_name, u.last_name].filter(Boolean).join(' ') || u.email : 'Unknown user';
  }

  // ── Membership / permission ────────────────────────────────────────────

  /** Throws unless `userId` may manage the listing (owner or staff). Returns the member row. */
  async assertCanManage(userId: string, providerId: string): Promise<DiscoveryProviderMember> {
    const member = await this.memberRepo.findOne({ where: { providerId, userId } });
    if (!member) throw new ForbiddenException('You do not manage this listing.');
    const listing = await this.providerRepo.findOne({ where: { id: providerId } });
    if (!listing) throw new NotFoundException('Listing not found');
    return member;
  }

  async addMember(
    m: EntityManager, providerId: string, userId: string, role: ProviderMemberRole, by: string,
  ): Promise<void> {
    const repo = m.getRepository(DiscoveryProviderMember);
    const existing = await repo.findOne({ where: { providerId, userId } });
    if (existing) {
      if (existing.role !== role && role === ProviderMemberRole.OWNER) await repo.update({ providerId, userId }, { role });
      return;
    }
    await repo.save(repo.create({ providerId, userId, role, createdBy: by }));
  }

  membershipsOf(userId: string): Promise<DiscoveryProviderMember[]> {
    return this.memberRepo.find({ where: { userId }, order: { createdAt: 'ASC' } });
  }

  async ownersOf(providerIds: string[]): Promise<Map<string, ListingOwnerDto[]>> {
    if (!providerIds.length) return new Map();
    const rows = await this.memberRepo.find({ where: { providerId: In(providerIds) }, order: { createdAt: 'ASC' } });
    const users = await this.usersById(rows.map((r) => r.userId));
    const out = new Map<string, ListingOwnerDto[]>();
    for (const r of rows) {
      const u = users.get(r.userId);
      out.set(r.providerId, [...(out.get(r.providerId) ?? []), {
        userId: r.userId, name: this.nameOf(u), email: u?.email ?? '', role: r.role,
      }]);
    }
    return out;
  }

  /** Ownership block for admin views (one query per kind, batched). */
  async ownershipFor(providers: DiscoveryProvider[]): Promise<Map<string, ListingOwnershipDto>> {
    const ids = providers.map((p) => p.id);
    const owners = await this.ownersOf(ids);
    const claims = ids.length
      ? await this.claimRepo.find({ where: { providerId: In(ids) }, order: { createdAt: 'DESC' } })
      : [];
    const out = new Map<string, ListingOwnershipDto>();
    for (const p of providers) {
      const mine = claims.filter((c) => c.providerId === p.id);
      out.set(p.id, {
        managementType: p.managementType ?? ManagementType.ADMIN_MANAGED,
        listingStatus: p.listingStatus ?? ListingStatus.PUBLISHED,
        reviewNote: p.reviewNote ?? null,
        submittedAt: p.submittedAt ?? null,
        owners: owners.get(p.id) ?? [],
        claimStatus: mine[0]?.status ?? 'NOT_CLAIMED',
        pendingClaims: mine.filter((c) => c.status === ClaimStatus.PENDING).length,
      });
    }
    return out;
  }

  // ── Claims (provider side) ─────────────────────────────────────────────

  async createClaim(userId: string, dto: CreateClaimDto): Promise<ClaimDto> {
    const listing = await this.providerRepo.findOne({ where: { id: dto.providerId } });
    if (!listing || !listing.isActive || listing.listingStatus !== ListingStatus.PUBLISHED) {
      throw new NotFoundException('Listing not found');
    }
    if (listing.managementType === ManagementType.PROVIDER_MANAGED || listing.userId) {
      throw new ConflictException('This listing is already managed by its business.');
    }
    if (await this.memberRepo.findOne({ where: { providerId: listing.id, userId } })) {
      throw new ConflictException('You already manage this listing.');
    }
    const pending = await this.claimRepo.findOne({ where: { providerId: listing.id, userId, status: ClaimStatus.PENDING } });
    if (pending) throw new ConflictException('You already have a pending claim for this listing.');

    const claim = await this.claimRepo.save(this.claimRepo.create({
      providerId: listing.id,
      userId,
      status: ClaimStatus.PENDING,
      message: dto.message,
      contactName: dto.contactName ?? null,
      contactPhone: dto.contactPhone ?? null,
      businessEmail: dto.businessEmail ?? null,
    }));
    this.auditEmitter.emit({
      eventType: AuditEventType.DISCOVERY_CLAIM_SUBMITTED,
      entityType: AuditEntityType.DISCOVERY_CLAIM,
      entityId: claim.id,
      userId,
      newValue: { providerId: listing.id },
      description: `Claim submitted for Discover listing "${listing.displayName}"`,
    });
    return this.toClaimDto(claim, listing.displayName);
  }

  async myClaims(userId: string): Promise<ClaimDto[]> {
    const rows = await this.claimRepo.find({ where: { userId }, order: { createdAt: 'DESC' }, take: 50 });
    const names = await this.listingNames(rows.map((r) => r.providerId));
    return rows.map((r) => this.toClaimDto(r, names.get(r.providerId) ?? null));
  }

  async cancelClaim(userId: string, claimId: string): Promise<ClaimDto> {
    const claim = await this.claimRepo.findOne({ where: { id: claimId, userId } });
    if (!claim) throw new NotFoundException('Claim not found');
    if (claim.status !== ClaimStatus.PENDING) throw new BadRequestException('Only pending claims can be withdrawn.');
    claim.status = ClaimStatus.CANCELLED;
    await this.claimRepo.save(claim);
    const names = await this.listingNames([claim.providerId]);
    return this.toClaimDto(claim, names.get(claim.providerId) ?? null);
  }

  private async listingNames(ids: string[]): Promise<Map<string, string>> {
    const unique = Array.from(new Set(ids));
    if (!unique.length) return new Map();
    const rows = await this.providerRepo.find({
      where: { id: In(unique) }, withDeleted: true, select: { id: true, displayName: true },
    });
    return new Map(rows.map((r) => [r.id, r.displayName]));
  }

  private toClaimDto(c: DiscoveryListingClaim, providerName: string | null): ClaimDto {
    return {
      id: c.id,
      providerId: c.providerId,
      providerName,
      status: c.status,
      message: c.message,
      contactName: c.contactName,
      contactPhone: c.contactPhone,
      businessEmail: c.businessEmail,
      adminNote: c.adminNote,
      createdAt: c.createdAt,
      reviewedAt: c.reviewedAt,
    };
  }

  // ── Claims (admin side) ────────────────────────────────────────────────

  async adminListClaims(q: AdminClaimQueryDto) {
    const page = q.page ?? 1;
    const limit = q.limit ?? 20;
    const [rows, total] = await this.claimRepo.findAndCount({
      where: q.status ? { status: q.status } : {},
      order: { createdAt: 'DESC', id: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    const listings = rows.length
      ? await this.providerRepo.find({ where: { id: In(rows.map((r) => r.providerId)) }, withDeleted: true })
      : [];
    const byId = new Map(listings.map((l) => [l.id, l]));
    const users = await this.usersById(rows.map((r) => r.userId));
    const items: ClaimDto[] = rows.map((r) => {
      const l = byId.get(r.providerId);
      const u = users.get(r.userId);
      return {
        ...this.toClaimDto(r, l?.displayName ?? null),
        claimant: { userId: r.userId, name: this.nameOf(u), email: u?.email ?? '' },
        listingContact: { phone: l?.phone ?? null, email: l?.email ?? null, website: l?.website ?? null },
      };
    });
    return { items, total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) };
  }

  /**
   * APPROVED: the claimant becomes OWNER, the listing becomes PROVIDER_MANAGED,
   * and any other pending claims for it are rejected. REJECTED: nothing changes
   * on the listing.
   */
  async decideClaim(claimId: string, dto: DecideClaimDto, adminId: string): Promise<ClaimDto> {
    const claim = await this.claimRepo.findOne({ where: { id: claimId } });
    if (!claim) throw new NotFoundException('Claim not found');
    if (claim.status !== ClaimStatus.PENDING) throw new BadRequestException('This claim has already been decided.');
    if (dto.status === ClaimStatus.REJECTED && !dto.note?.trim()) {
      throw new BadRequestException('Add a note explaining why the claim was rejected.');
    }

    await this.dataSource.transaction(async (m) => {
      const now = new Date();
      await m.update(DiscoveryListingClaim, { id: claim.id }, {
        status: dto.status, adminNote: dto.note ?? null, reviewedBy: adminId, reviewedAt: now,
      });
      if (dto.status === ClaimStatus.APPROVED) {
        const listing = await m.findOne(DiscoveryProvider, { where: { id: claim.providerId } });
        if (!listing) throw new NotFoundException('Listing not found (restore it first if it was deleted)');
        await this.addMember(m, listing.id, claim.userId, ProviderMemberRole.OWNER, adminId);
        await m.update(DiscoveryProvider, { id: listing.id }, {
          managementType: ManagementType.PROVIDER_MANAGED,
          userId: listing.userId ?? claim.userId,
        });
        await m.createQueryBuilder()
          .update(DiscoveryListingClaim)
          .set({ status: ClaimStatus.REJECTED, adminNote: 'Another ownership claim for this listing was approved.', reviewedBy: adminId, reviewedAt: now })
          .where('provider_id = :pid AND status = :pending AND id <> :id', { pid: listing.id, pending: ClaimStatus.PENDING, id: claim.id })
          .execute();
      }
    });

    this.auditEmitter.emit({
      eventType: AuditEventType.DISCOVERY_CLAIM_DECIDED,
      entityType: AuditEntityType.DISCOVERY_CLAIM,
      entityId: claim.id,
      userId: adminId,
      oldValue: { status: ClaimStatus.PENDING },
      newValue: { status: dto.status, providerId: claim.providerId, claimant: claim.userId, note: dto.note ?? null },
      description: `Discover listing claim ${dto.status.toLowerCase()}`,
    });
    const updated = await this.claimRepo.findOneOrFail({ where: { id: claim.id } });
    const names = await this.listingNames([claim.providerId]);
    return this.toClaimDto(updated, names.get(claim.providerId) ?? null);
  }

  // ── Submissions & management (admin) ───────────────────────────────────

  async reviewSubmission(providerId: string, dto: ReviewSubmissionDto, adminId: string): Promise<void> {
    const p = await this.providerRepo.findOne({ where: { id: providerId } });
    if (!p) throw new NotFoundException('Listing not found');
    if (dto.decision !== 'PUBLISH' && !dto.note?.trim()) {
      throw new BadRequestException('Tell the provider what to change (note is required).');
    }
    const before = { listingStatus: p.listingStatus, verificationStatus: p.verificationStatus };
    if (dto.decision === 'PUBLISH') {
      p.listingStatus = ListingStatus.PUBLISHED;
      if (p.verificationStatus === ProviderVerificationStatus.REJECTED) p.verificationStatus = ProviderVerificationStatus.PENDING;
      p.reviewNote = dto.note ?? null;
    } else if (dto.decision === 'REQUEST_CHANGES') {
      p.listingStatus = ListingStatus.CHANGES_REQUESTED;
      p.reviewNote = dto.note!;
    } else {
      p.listingStatus = ListingStatus.CHANGES_REQUESTED;
      p.verificationStatus = ProviderVerificationStatus.REJECTED;
      p.verifiedAt = null;
      p.verifiedBy = null;
      p.reviewNote = dto.note!;
    }
    await this.providerRepo.save(p);
    this.auditEmitter.emit({
      eventType: AuditEventType.DISCOVERY_LISTING_REVIEWED,
      entityType: AuditEntityType.DISCOVERY_PROVIDER,
      entityId: providerId,
      userId: adminId,
      oldValue: before,
      newValue: { decision: dto.decision, listingStatus: p.listingStatus, verificationStatus: p.verificationStatus, note: dto.note ?? null },
      description: `Discover listing review: ${dto.decision}`,
    });
  }

  /**
   * ADMIN_MANAGED: admin takes the listing over — provider access is revoked.
   * PROVIDER_MANAGED: assigns an existing, verified account as OWNER.
   */
  async setManagement(providerId: string, dto: SetManagementDto, adminId: string): Promise<void> {
    const p = await this.providerRepo.findOne({ where: { id: providerId } });
    if (!p) throw new NotFoundException('Listing not found');
    const before = { managementType: p.managementType, userId: p.userId, owners: (await this.ownersOf([providerId])).get(providerId) ?? [] };

    if (dto.managementType === ManagementType.ADMIN_MANAGED) {
      await this.dataSource.transaction(async (m) => {
        await m.delete(DiscoveryProviderMember, { providerId });
        await m.update(DiscoveryProvider, { id: providerId }, { managementType: ManagementType.ADMIN_MANAGED, userId: null });
      });
    } else {
      if (!dto.ownerEmail) throw new BadRequestException('Enter the email of the account that will manage this listing.');
      const [user]: UserRow[] = await this.dataSource.query(
        'SELECT id, first_name, last_name, email, is_active, is_email_verified, is_deleted FROM `user` WHERE email = ? LIMIT 1',
        [dto.ownerEmail],
      );
      if (!user || Number(user.is_deleted) === 1) throw new NotFoundException('No Aurora account uses that email.');
      if (Number(user.is_active) !== 1 || Number(user.is_email_verified) !== 1) {
        throw new BadRequestException('That account must verify its email before it can manage a listing.');
      }
      await this.dataSource.transaction(async (m) => {
        await this.addMember(m, providerId, user.id, ProviderMemberRole.OWNER, adminId);
        await m.update(DiscoveryProvider, { id: providerId }, {
          managementType: ManagementType.PROVIDER_MANAGED, userId: p.userId ?? user.id,
        });
      });
    }
    this.auditEmitter.emit({
      eventType: AuditEventType.DISCOVERY_MANAGEMENT_CHANGED,
      entityType: AuditEntityType.DISCOVERY_PROVIDER,
      entityId: providerId,
      userId: adminId,
      oldValue: before as unknown as Record<string, unknown>,
      newValue: { managementType: dto.managementType, ownerEmail: dto.ownerEmail ?? null },
      description: `Discover listing management → ${dto.managementType}`,
    });
  }
}
