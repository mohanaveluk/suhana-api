import {
  BadRequestException, Inject, Injectable, NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import sharp from 'sharp';
import { DISCOVERY_COUNTRIES } from '../constants/discovery.constants';
import { ProviderVerificationStatus } from '../constants/discovery.enums';
import {
  DiscoveryLocation, DiscoveryProvider, DiscoveryProviderCategory, DiscoveryProviderLanguage, DiscoveryProviderMedia,
  DiscoveryService,
} from '../entities';
import {
  AdminProviderQueryDto, CreateProviderDto, GeocodeQueryDto, LocationInputDto, ProviderVerificationDto, ServiceInputDto,
  UpdateLocationDto, UpdateProviderDto,
} from '../dto/discovery-admin.dto';
import { CategoryHandlerRegistry } from '../categories/category-handler.registry';
import { CategoryAdminInput } from '../categories/category-handler';
import { DiscoveryCatalogService } from './discovery-catalog.service';
import { LocationResolverService } from '../geo/location-resolver.service';
import { GEOCODING_PROVIDER, GeocodeResult, GeocodingProvider } from '../geo/geocoding.provider';
import { CloudStorageService } from '../../../common/services/cloud-storage.service';
import { DiscoveryOwnershipService } from './discovery-ownership.service';
import { ListingOwnershipDto } from '../dto/discovery-provider-portal.dto';
import { AuditEmitter } from '../../audit/audit.emitter';
import { AuditEventType } from '../../audit/enums/audit-event-type.enum';
import { AuditEntityType } from '../../audit/enums/audit-entity-type.enum';

export type GeocodeSource = 'manual' | 'postal' | 'city' | 'none';

export interface AdminLocationDto {
  id: string;
  label: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string;
  state: string | null;
  postalCode: string | null;
  country: string;
  latitude: number | null;
  longitude: number | null;
  showStreetAddress: boolean;
  isPrimary: boolean;
  isActive: boolean;
}

export interface AdminProviderDto extends Partial<ListingOwnershipDto> {
  id: string;
  userId: string | null;
  displayName: string;
  businessName: string | null;
  headline: string | null;
  about: string | null;
  photoUrl: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  verificationStatus: ProviderVerificationStatus;
  verificationNotes: string | null;
  verifiedAt: Date | null;
  isActive: boolean;
  acceptingClients: boolean;
  ratingAvg: number | null;
  ratingCount: number;
  categorySlugs: string[];
  languages: string[];
  locations: AdminLocationDto[];
  services: Array<ServiceInputDto & { id: string; displayOrder: number }>;
  media: Array<{ id: string; url: string; caption: string | null; displayOrder: number }>;
  astrologer?: CategoryAdminInput['astrologer'];
  categoryDetails?: CategoryAdminInput['categoryDetails'];
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  /** Geocoding outcome per location from the last write (create / location add / update). */
  geocoding?: Array<{ city: string; source: GeocodeSource }>;
}

export interface AdminProviderSummaryDto extends Partial<ListingOwnershipDto> {
  id: string;
  displayName: string;
  businessName: string | null;
  verificationStatus: ProviderVerificationStatus;
  isActive: boolean;
  categorySlugs: string[];
  primaryPlace: string | null;
  locationCount: number;
  missingCoordinates: boolean;
  ratingAvg: number | null;
  ratingCount: number;
  updatedAt: Date;
  deletedAt: Date | null;
}

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const IMAGE_MIME = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

/** Picks only known fields — ValidationPipe has no whitelist (API CLAUDE.md gotcha). */
const SCALAR_FIELDS = [
  'displayName', 'businessName', 'headline', 'about', 'photoUrl', 'email', 'phone', 'website', 'isActive',
  'acceptingClients',
] as const;

@Injectable()
export class DiscoveryAdminService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(DiscoveryProvider) private readonly providerRepo: Repository<DiscoveryProvider>,
    @InjectRepository(DiscoveryLocation) private readonly locationRepo: Repository<DiscoveryLocation>,
    @InjectRepository(DiscoveryProviderMedia) private readonly mediaRepo: Repository<DiscoveryProviderMedia>,
    private readonly catalog: DiscoveryCatalogService,
    private readonly handlers: CategoryHandlerRegistry,
    private readonly locations: LocationResolverService,
    @Inject(GEOCODING_PROVIDER) private readonly geocoder: GeocodingProvider,
    private readonly storage: CloudStorageService,
    private readonly auditEmitter: AuditEmitter,
    private readonly ownership?: DiscoveryOwnershipService,
  ) {}

  // ── Read ────────────────────────────────────────────────────────────────

  async list(q: AdminProviderQueryDto) {
    const page = q.page ?? 1;
    const limit = q.limit ?? 20;
    const qb = this.providerRepo.createQueryBuilder('p');
    if (q.includeDeleted) qb.withDeleted();
    if (q.q?.trim()) {
      const like = `%${q.q.trim().replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
      qb.andWhere('(p.display_name LIKE :like OR p.business_name LIKE :like OR p.email LIKE :like OR p.phone LIKE :like)', { like });
    }
    if (q.status) qb.andWhere('p.verification_status = :status', { status: q.status });
    if (q.listingStatus) qb.andWhere('p.listing_status = :listingStatus', { listingStatus: q.listingStatus });
    if (q.managementType) qb.andWhere('p.management_type = :managementType', { managementType: q.managementType });
    if (q.category) {
      qb.andWhere(
        'EXISTS (SELECT 1 FROM discovery_provider_categories pc INNER JOIN discovery_categories c ON c.id = pc.category_id WHERE pc.provider_id = p.id AND c.slug = :cat)',
        { cat: q.category },
      );
    }
    if (q.country) {
      qb.andWhere('EXISTS (SELECT 1 FROM discovery_locations l WHERE l.provider_id = p.id AND l.country = :country)', {
        country: q.country,
      });
    }
    qb.orderBy('p.updated_at', 'DESC').addOrderBy('p.id', 'ASC').skip((page - 1) * limit).take(limit);
    const [rows, total] = await qb.getManyAndCount();

    const full = rows.length
      ? await this.providerRepo.find({
          where: { id: In(rows.map((r) => r.id)) },
          withDeleted: true,
          relations: { locations: true, categories: { category: true } },
        })
      : [];
    const byId = new Map(full.map((p) => [p.id, p]));
    const owned = this.ownership ? await this.ownership.ownershipFor(full) : new Map<string, ListingOwnershipDto>();
    const items: AdminProviderSummaryDto[] = rows.map((r) => {
      const p = byId.get(r.id) ?? r;
      const locs = p.locations ?? [];
      const primary = locs.find((l) => l.isPrimary) ?? locs[0];
      return {
        id: p.id,
        displayName: p.displayName,
        businessName: p.businessName ?? null,
        verificationStatus: p.verificationStatus,
        isActive: p.isActive,
        categorySlugs: (p.categories ?? []).map((c) => c.category?.slug).filter(Boolean),
        primaryPlace: primary ? [primary.city, primary.state, primary.country].filter(Boolean).join(', ') : null,
        locationCount: locs.length,
        missingCoordinates: locs.some((l) => l.isActive && (l.latitude === null || l.longitude === null)),
        ratingAvg: p.ratingAvg,
        ratingCount: p.ratingCount,
        updatedAt: p.updatedAt,
        deletedAt: p.deletedAt ?? null,
        ...(owned.get(p.id) ?? {}),
      };
    });
    return { items, total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) };
  }

  async get(id: string): Promise<AdminProviderDto> {
    const p = await this.providerRepo.findOne({
      where: { id },
      withDeleted: true,
      relations: { locations: true, languages: true, services: true, categories: { category: true } },
    });
    if (!p) throw new NotFoundException('Listing not found');
    const media = await this.mediaRepo.find({ where: { providerId: id }, order: { displayOrder: 'ASC', createdAt: 'ASC' } });
    const ownership = this.ownership ? (await this.ownership.ownershipFor([p])).get(p.id) : undefined;

    const slugs = (p.categories ?? [])
      .sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary))
      .map((c) => c.category?.slug)
      .filter(Boolean);
    const extras: CategoryAdminInput = {};
    for (const slug of slugs) {
      const handler = this.handlers.for(slug);
      const details = await handler.loadDetails([id]);
      const input = handler.toAdminInput(details.get(id));
      if (input.astrologer) extras.astrologer = input.astrologer;
      if (input.categoryDetails?.length) {
        extras.categoryDetails = [...(extras.categoryDetails ?? []), ...input.categoryDetails];
      }
    }

    return {
      id: p.id,
      userId: p.userId,
      displayName: p.displayName,
      businessName: p.businessName,
      headline: p.headline,
      about: p.about,
      photoUrl: p.photoUrl,
      email: p.email,
      phone: p.phone,
      website: p.website,
      verificationStatus: p.verificationStatus,
      verificationNotes: p.verificationNotes,
      verifiedAt: p.verifiedAt,
      isActive: p.isActive,
      acceptingClients: p.acceptingClients,
      ratingAvg: p.ratingAvg,
      ratingCount: p.ratingCount,
      categorySlugs: slugs,
      languages: (p.languages ?? []).map((l) => l.languageCode).sort(),
      locations: (p.locations ?? [])
        .sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary) || a.createdAt.getTime() - b.createdAt.getTime())
        .map((l) => this.toAdminLocation(l)),
      services: (p.services ?? [])
        .sort((a, b) => a.displayOrder - b.displayOrder)
        .map((s) => ({
          id: s.id,
          name: s.name,
          specialization: s.specialization,
          consultationMode: s.consultationMode,
          price: s.price,
          currency: s.currency,
          durationMinutes: s.durationMinutes,
          description: s.description,
          isActive: s.isActive,
          displayOrder: s.displayOrder,
        })),
      media: media.map((m) => ({ id: m.id, url: m.url, caption: m.caption, displayOrder: m.displayOrder })),
      ...extras,
      ...(ownership ?? {}),
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      deletedAt: p.deletedAt ?? null,
    };
  }

  private toAdminLocation(l: DiscoveryLocation): AdminLocationDto {
    return {
      id: l.id,
      label: l.label,
      addressLine1: l.addressLine1,
      addressLine2: l.addressLine2,
      city: l.city,
      state: l.state,
      postalCode: l.postalCode,
      country: l.country,
      latitude: l.latitude,
      longitude: l.longitude,
      showStreetAddress: l.showStreetAddress,
      isPrimary: l.isPrimary,
      isActive: l.isActive,
    };
  }

  // ── Geocoding helper ────────────────────────────────────────────────────

  async geocode(q: GeocodeQueryDto): Promise<GeocodeResult> {
    if (q.postalCode?.trim()) {
      const code = this.locations.normalisePostal(q.country, q.postalCode);
      const hit = await this.geocoder.lookupPostalCode(q.country, code);
      if (!hit) throw new NotFoundException(`No coordinates found for ${DISCOVERY_COUNTRIES[q.country].postalLabel} ${code}.`);
      return hit;
    }
    if (q.city?.trim()) {
      const hit = await this.geocoder.lookupCity(q.country, q.city.trim(), q.state?.trim() || null);
      if (!hit) throw new NotFoundException(`No coordinates found for ${q.city.trim()}.`);
      return hit;
    }
    throw new BadRequestException('Provide a postal code or a city.');
  }

  /**
   * Coordinates for a location: explicit lat/lng win; else the postal code;
   * else the city centroid; else none (the location then only matches
   * state/city text searches, and the admin list flags it).
   */
  async resolveCoordinates(input: LocationInputDto): Promise<{ lat: number | null; lng: number | null; source: GeocodeSource; postalCode: string | null }> {
    let postalCode = input.postalCode?.trim() || null;
    if (postalCode) postalCode = this.locations.normalisePostal(input.country, postalCode);
    if (input.latitude !== undefined && input.latitude !== null && input.longitude !== undefined && input.longitude !== null) {
      return { lat: input.latitude, lng: input.longitude, source: 'manual', postalCode };
    }
    if (postalCode) {
      const hit = await this.geocoder.lookupPostalCode(input.country, postalCode);
      if (hit) return { lat: hit.lat, lng: hit.lng, source: 'postal', postalCode };
    }
    const hit = await this.geocoder.lookupCity(input.country, input.city.trim(), input.state?.trim() || null);
    if (hit) return { lat: hit.lat, lng: hit.lng, source: 'city', postalCode };
    return { lat: null, lng: null, source: 'none', postalCode };
  }

  // ── Create / update ─────────────────────────────────────────────────────

  private async resolveCategories(slugs: string[]) {
    const unique = Array.from(new Set(slugs.map((s) => s.trim()).filter(Boolean)));
    const cats = await this.catalog.findBySlugs(unique);
    const missing = unique.filter((s) => !cats.some((c) => c.slug === s));
    if (missing.length) throw new BadRequestException(`Unknown category: ${missing.join(', ')}`);
    // Keep the caller's order: the first slug is the primary category.
    return unique.map((s) => cats.find((c) => c.slug === s)!);
  }

  private applyScalars(p: DiscoveryProvider, dto: CreateProviderDto | UpdateProviderDto) {
    for (const f of SCALAR_FIELDS) {
      if (dto[f] !== undefined) (p as any)[f] = dto[f];
    }
  }

  private snapshot(p: DiscoveryProvider): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const f of SCALAR_FIELDS) out[f] = p[f];
    return out;
  }

  private async replaceServices(
    m: EntityManager, providerId: string, categoryId: number, services: ServiceInputDto[], fallbackCurrency: string,
  ) {
    await m.delete(DiscoveryService, { providerId });
    if (!services.length) return;
    await m.save(
      DiscoveryService,
      services.map((s, i) =>
        m.create(DiscoveryService, {
          providerId,
          categoryId,
          name: s.name,
          specialization: s.specialization ?? null,
          consultationMode: s.consultationMode,
          price: s.price ?? null,
          currency: s.price === null || s.price === undefined ? s.currency ?? null : s.currency ?? fallbackCurrency,
          durationMinutes: s.durationMinutes ?? null,
          description: s.description ?? null,
          isActive: s.isActive ?? true,
          displayOrder: i,
        }),
      ),
    );
  }

  private async replaceLanguages(m: EntityManager, providerId: string, languages: string[]) {
    await m.delete(DiscoveryProviderLanguage, { providerId });
    const unique = Array.from(new Set(languages));
    if (unique.length) {
      await m.save(DiscoveryProviderLanguage, unique.map((languageCode) => m.create(DiscoveryProviderLanguage, { providerId, languageCode })));
    }
  }

  private async replaceCategories(m: EntityManager, providerId: string, categoryIds: number[]) {
    await m.delete(DiscoveryProviderCategory, { providerId });
    await m.save(
      DiscoveryProviderCategory,
      categoryIds.map((categoryId, i) => m.create(DiscoveryProviderCategory, { providerId, categoryId, isPrimary: i === 0 })),
    );
  }

  private async currencyFor(providerId: string, m: EntityManager): Promise<string> {
    const loc = await m.findOne(DiscoveryLocation, { where: { providerId }, order: { isPrimary: 'DESC', createdAt: 'ASC' } });
    return loc ? DISCOVERY_COUNTRIES[loc.country]?.currency ?? 'USD' : 'USD';
  }

  async create(dto: CreateProviderDto, adminId: string): Promise<AdminProviderDto> {
    const categories = await this.resolveCategories(dto.categorySlugs);
    // Geocode outside the transaction (read-only lookups); errors surface as 400s.
    const locationInputs = dto.locations ?? [];
    const coords = await Promise.all(locationInputs.map((l) => this.resolveCoordinates(l)));

    const id = await this.dataSource.transaction(async (m) => {
      const p = m.create(DiscoveryProvider, {
        verificationStatus: ProviderVerificationStatus.PENDING,
        createdBy: adminId,
        userId: null,
        ratingCount: 0,
        ratingAvg: null,
      });
      this.applyScalars(p, dto);
      const saved = await m.save(DiscoveryProvider, p);

      await this.replaceCategories(m, saved.id, categories.map((c) => c.id));
      await this.replaceLanguages(m, saved.id, dto.languages ?? []);

      const primaryIdx = Math.max(0, locationInputs.findIndex((l) => l.isPrimary));
      if (locationInputs.length) {
        await m.save(
          DiscoveryLocation,
          locationInputs.map((l, i) => this.buildLocation(m, saved.id, l, coords[i], i === primaryIdx)),
        );
      }
      const currency = locationInputs[primaryIdx]
        ? DISCOVERY_COUNTRIES[locationInputs[primaryIdx].country].currency
        : 'USD';
      await this.replaceServices(m, saved.id, categories[0].id, dto.services ?? [], currency);
      for (const c of categories) await this.handlers.for(c.slug).saveDetails(m, saved.id, dto);
      return saved.id;
    });

    this.auditEmitter.emit({
      eventType: AuditEventType.DISCOVERY_PROVIDER_CREATED,
      entityType: AuditEntityType.DISCOVERY_PROVIDER,
      entityId: id,
      userId: adminId,
      newValue: { displayName: dto.displayName, categories: dto.categorySlugs, locations: locationInputs.length },
      description: `Discover listing created: ${dto.displayName}`,
    });
    const out = await this.get(id);
    out.geocoding = locationInputs.map((l, i) => ({ city: l.city, source: coords[i].source }));
    return out;
  }

  private buildLocation(
    m: EntityManager, providerId: string, l: LocationInputDto,
    c: { lat: number | null; lng: number | null; postalCode: string | null }, isPrimary: boolean,
  ): DiscoveryLocation {
    return m.create(DiscoveryLocation, {
      providerId,
      label: l.label ?? null,
      addressLine1: l.addressLine1 ?? null,
      addressLine2: l.addressLine2 ?? null,
      city: l.city.trim(),
      state: l.state ?? null,
      postalCode: c.postalCode,
      country: l.country,
      latitude: c.lat,
      longitude: c.lng,
      showStreetAddress: l.showStreetAddress ?? true,
      isPrimary,
      isActive: l.isActive ?? true,
    });
  }

  private async requireProvider(id: string, m?: EntityManager): Promise<DiscoveryProvider> {
    const repo = m ? m.getRepository(DiscoveryProvider) : this.providerRepo;
    const p = await repo.findOne({ where: { id } });
    if (!p) throw new NotFoundException('Listing not found (restore it first if it was deleted)');
    return p;
  }

  async update(id: string, dto: UpdateProviderDto, adminId: string): Promise<AdminProviderDto> {
    const categories = dto.categorySlugs ? await this.resolveCategories(dto.categorySlugs) : null;
    let before: Record<string, unknown> = {};
    let after: Record<string, unknown> = {};

    await this.dataSource.transaction(async (m) => {
      const p = await this.requireProvider(id, m);
      before = this.snapshot(p);
      this.applyScalars(p, dto);
      await m.save(DiscoveryProvider, p);
      after = this.snapshot(p);

      if (categories) await this.replaceCategories(m, id, categories.map((c) => c.id));
      if (dto.languages) await this.replaceLanguages(m, id, dto.languages);

      const cats = categories ?? (await m.find(DiscoveryProviderCategory, { where: { providerId: id }, relations: { category: true } }))
        .sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary))
        .map((pc) => pc.category);
      if (dto.services) {
        const primaryCategoryId = cats[0]?.id;
        if (!primaryCategoryId) throw new BadRequestException('Listing has no category');
        await this.replaceServices(m, id, primaryCategoryId, dto.services, await this.currencyFor(id, m));
      }
      for (const c of cats) await this.handlers.for(c.slug).saveDetails(m, id, dto);
    });

    this.auditEmitter.emit({
      eventType: AuditEventType.DISCOVERY_PROVIDER_UPDATED,
      entityType: AuditEntityType.DISCOVERY_PROVIDER,
      entityId: id,
      userId: adminId,
      oldValue: before,
      newValue: {
        ...after,
        ...(dto.categorySlugs ? { categories: dto.categorySlugs } : {}),
        ...(dto.languages ? { languages: dto.languages } : {}),
        ...(dto.services ? { services: dto.services.length } : {}),
      },
      description: 'Discover listing updated',
    });
    return this.get(id);
  }

  async remove(id: string, adminId: string): Promise<{ id: string; deleted: true }> {
    const p = await this.requireProvider(id);
    await this.providerRepo.softDelete({ id });
    this.auditEmitter.emit({
      eventType: AuditEventType.DISCOVERY_PROVIDER_DELETED,
      entityType: AuditEntityType.DISCOVERY_PROVIDER,
      entityId: id,
      userId: adminId,
      oldValue: { displayName: p.displayName },
      description: `Discover listing deleted (soft): ${p.displayName}`,
    });
    return { id, deleted: true };
  }

  async restore(id: string, adminId: string): Promise<AdminProviderDto> {
    const p = await this.providerRepo.findOne({ where: { id }, withDeleted: true });
    if (!p) throw new NotFoundException('Listing not found');
    await this.providerRepo.restore({ id });
    this.auditEmitter.emit({
      eventType: AuditEventType.DISCOVERY_PROVIDER_RESTORED,
      entityType: AuditEntityType.DISCOVERY_PROVIDER,
      entityId: id,
      userId: adminId,
      description: `Discover listing restored: ${p.displayName}`,
    });
    return this.get(id);
  }

  /**
   * Verification workflow for the BUSINESS LISTING:
   *   PENDING → VERIFIED | REJECTED ; VERIFIED → SUSPENDED ; any → PENDING (re-review).
   * REJECTED / SUSPENDED hide the listing from members and require a note.
   */
  async setVerification(id: string, dto: ProviderVerificationDto, adminId: string): Promise<AdminProviderDto> {
    const p = await this.requireProvider(id);
    const needsNote = [ProviderVerificationStatus.REJECTED, ProviderVerificationStatus.SUSPENDED].includes(dto.status);
    if (needsNote && !dto.notes?.trim()) {
      throw new BadRequestException('A note is required when rejecting or suspending a listing.');
    }
    const before = { status: p.verificationStatus, notes: p.verificationNotes };
    p.verificationStatus = dto.status;
    if (dto.notes !== undefined) p.verificationNotes = dto.notes;
    if (dto.status === ProviderVerificationStatus.VERIFIED) {
      p.verifiedAt = new Date();
      p.verifiedBy = adminId;
    } else {
      p.verifiedAt = null;
      p.verifiedBy = null;
    }
    await this.providerRepo.save(p);
    this.auditEmitter.emit({
      eventType: AuditEventType.DISCOVERY_PROVIDER_VERIFICATION_CHANGED,
      entityType: AuditEntityType.DISCOVERY_PROVIDER,
      entityId: id,
      userId: adminId,
      oldValue: before,
      newValue: { status: dto.status, notes: p.verificationNotes },
      description: `Discover listing verification ${before.status} → ${dto.status}`,
    });
    return this.get(id);
  }

  // ── Locations ───────────────────────────────────────────────────────────

  async addLocation(providerId: string, dto: LocationInputDto, adminId: string): Promise<AdminProviderDto> {
    await this.requireProvider(providerId);
    const c = await this.resolveCoordinates(dto);
    const saved = await this.dataSource.transaction(async (m) => {
      const count = await m.count(DiscoveryLocation, { where: { providerId } });
      const isPrimary = dto.isPrimary === true || count === 0;
      if (isPrimary) await m.update(DiscoveryLocation, { providerId }, { isPrimary: false });
      return m.save(DiscoveryLocation, this.buildLocation(m, providerId, dto, c, isPrimary));
    });
    this.auditEmitter.emit({
      eventType: AuditEventType.DISCOVERY_LOCATION_ADDED,
      entityType: AuditEntityType.DISCOVERY_LOCATION,
      entityId: saved.id,
      userId: adminId,
      newValue: { providerId, city: saved.city, state: saved.state, country: saved.country, geocode: c.source },
      description: 'Discover location added',
    });
    const out = await this.get(providerId);
    out.geocoding = [{ city: saved.city, source: c.source }];
    return out;
  }

  async updateLocation(providerId: string, locationId: string, dto: UpdateLocationDto, adminId: string): Promise<AdminProviderDto> {
    await this.requireProvider(providerId);
    const loc = await this.locationRepo.findOne({ where: { id: locationId, providerId } });
    if (!loc) throw new NotFoundException('Location not found');
    const before = this.toAdminLocation(loc);
    const c = await this.resolveCoordinates(dto);
    await this.dataSource.transaction(async (m) => {
      if (dto.isPrimary === true) await m.update(DiscoveryLocation, { providerId }, { isPrimary: false });
      Object.assign(loc, {
        label: dto.label ?? null,
        addressLine1: dto.addressLine1 ?? null,
        addressLine2: dto.addressLine2 ?? null,
        city: dto.city.trim(),
        state: dto.state ?? null,
        postalCode: c.postalCode,
        country: dto.country,
        latitude: c.lat,
        longitude: c.lng,
        showStreetAddress: dto.showStreetAddress ?? loc.showStreetAddress,
        isPrimary: dto.isPrimary === true ? true : loc.isPrimary,
        isActive: dto.isActive ?? loc.isActive,
      });
      await m.save(DiscoveryLocation, loc);
    });
    this.auditEmitter.emit({
      eventType: AuditEventType.DISCOVERY_LOCATION_UPDATED,
      entityType: AuditEntityType.DISCOVERY_LOCATION,
      entityId: locationId,
      userId: adminId,
      oldValue: before as unknown as Record<string, unknown>,
      newValue: this.toAdminLocation(loc) as unknown as Record<string, unknown>,
      description: 'Discover location updated',
    });
    const out = await this.get(providerId);
    out.geocoding = [{ city: loc.city, source: c.source }];
    return out;
  }

  async deleteLocation(providerId: string, locationId: string, adminId: string): Promise<AdminProviderDto> {
    const loc = await this.locationRepo.findOne({ where: { id: locationId, providerId } });
    if (!loc) throw new NotFoundException('Location not found');
    await this.dataSource.transaction(async (m) => {
      await m.delete(DiscoveryLocation, { id: locationId, providerId });
      if (loc.isPrimary) {
        const next = await m.findOne(DiscoveryLocation, { where: { providerId }, order: { createdAt: 'ASC' } });
        if (next) await m.update(DiscoveryLocation, { id: next.id }, { isPrimary: true });
      }
    });
    this.auditEmitter.emit({
      eventType: AuditEventType.DISCOVERY_LOCATION_DELETED,
      entityType: AuditEntityType.DISCOVERY_LOCATION,
      entityId: locationId,
      userId: adminId,
      oldValue: this.toAdminLocation(loc) as unknown as Record<string, unknown>,
      description: 'Discover location deleted',
    });
    return this.get(providerId);
  }

  // ── Media ───────────────────────────────────────────────────────────────

  async uploadMedia(
    providerId: string, file: Express.Multer.File | undefined, caption: string | null, setAsPhoto: boolean, adminId: string,
  ): Promise<AdminProviderDto> {
    const p = await this.requireProvider(providerId);
    if (!file?.buffer?.length) throw new BadRequestException('No image provided');
    if (!IMAGE_MIME.includes(file.mimetype)) throw new BadRequestException('Use a JPEG, PNG or WebP image.');
    if (file.size > MAX_IMAGE_BYTES) throw new BadRequestException('Images must be 8 MB or smaller.');

    // Normalise: strip metadata (EXIF/GPS), cap size, re-encode as JPEG.
    let buffer: Buffer;
    try {
      buffer = await sharp(file.buffer).rotate().resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 82, mozjpeg: true }).toBuffer();
    } catch {
      throw new BadRequestException('That file could not be read as an image.');
    }
    const stamp = new Date().toISOString().replace(/[-:T.Z]/g, '');
    const url = await this.storage.uploadToPath(
      { ...file, buffer, size: buffer.length, mimetype: 'image/jpeg' } as Express.Multer.File,
      `discovery/providers/${providerId}/${stamp}.jpg`,
    );
    const count = await this.mediaRepo.count({ where: { providerId } });
    const media = await this.mediaRepo.save(this.mediaRepo.create({ providerId, url, caption, displayOrder: count }));
    if (setAsPhoto || !p.photoUrl) await this.providerRepo.update({ id: providerId }, { photoUrl: url });
    this.auditEmitter.emit({
      eventType: AuditEventType.DISCOVERY_MEDIA_ADDED,
      entityType: AuditEntityType.DISCOVERY_PROVIDER,
      entityId: providerId,
      userId: adminId,
      newValue: { mediaId: media.id, url, setAsPhoto },
      description: 'Discover listing photo added',
    });
    return this.get(providerId);
  }

  async deleteMedia(providerId: string, mediaId: string, adminId: string): Promise<AdminProviderDto> {
    const media = await this.mediaRepo.findOne({ where: { id: mediaId, providerId } });
    if (!media) throw new NotFoundException('Photo not found');
    await this.mediaRepo.delete({ id: mediaId, providerId });
    const p = await this.providerRepo.findOne({ where: { id: providerId }, withDeleted: true });
    if (p?.photoUrl === media.url) await this.providerRepo.update({ id: providerId }, { photoUrl: null });
    if (this.storage.isOwnUrlUnder(media.url, 'discovery')) {
      await this.storage.deleteFile(media.url).catch(() => undefined);
    }
    this.auditEmitter.emit({
      eventType: AuditEventType.DISCOVERY_MEDIA_DELETED,
      entityType: AuditEntityType.DISCOVERY_PROVIDER,
      entityId: providerId,
      userId: adminId,
      oldValue: { mediaId, url: media.url },
      description: 'Discover listing photo deleted',
    });
    return this.get(providerId);
  }
}
