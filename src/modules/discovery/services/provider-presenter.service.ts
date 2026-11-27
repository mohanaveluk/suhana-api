import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { DistanceUnit } from '../constants/discovery.constants';
import {
  ConsultationMode, HIDDEN_VERIFICATION_STATUSES, ListingStatus, ManagementType, ProviderVerificationStatus,
} from '../constants/discovery.enums';
import { DiscoveryProvider } from '../entities/discovery-provider.entity';
import { DiscoveryLocation } from '../entities/discovery-location.entity';
import { DiscoveryFavorite } from '../entities/discovery-favorite.entity';
import { DiscoveryProviderMedia } from '../entities/discovery-provider-media.entity';
import { ProviderCardDto, ProviderPlaceDto } from '../dto/discovery-search.dto';
import { ProviderDetailDto, ProviderLocationDto } from '../dto/discovery-detail.dto';
import { CategoryHandlerRegistry } from '../categories/category-handler.registry';
import { fromKm, haversineKm, LatLng } from '../geo/geo.util';

export interface PresentOptions {
  userId: string;
  /** Category the caller searched in; otherwise the provider's primary category. */
  categorySlug?: string | null;
  origin?: LatLng | null;
  /** Text-area search (state/city without coordinates): show the location that matched. */
  area?: { country: string | null; state: string | null; city: string | null } | null;
  unit: DistanceUnit;
}

const sameText = (a: string | null | undefined, b: string | null | undefined) =>
  (a ?? '').trim().toLowerCase() === (b ?? '').trim().toLowerCase();

/** Visible to members = active, published, not deleted, not rejected/suspended. */
export function isProviderVisible(
  p: Pick<DiscoveryProvider, 'isActive' | 'deletedAt' | 'verificationStatus'> & { listingStatus?: ListingStatus } | null,
): boolean {
  return !!p && p.isActive && !p.deletedAt && !HIDDEN_VERIFICATION_STATUSES.includes(p.verificationStatus)
    // Rows loaded before the column existed (or mocks) count as published.
    && (p.listingStatus === undefined || p.listingStatus === ListingStatus.PUBLISHED);
}

const round1 = (n: number) => Math.round(n * 10) / 10;

export function formatAddress(l: DiscoveryLocation): string | null {
  if (!l.showStreetAddress || !l.addressLine1) return null;
  return [l.addressLine1, l.addressLine2, l.city, [l.state, l.postalCode].filter(Boolean).join(' '), l.country]
    .filter((x) => !!x && String(x).trim())
    .join(', ');
}

export function toPlace(l: DiscoveryLocation): ProviderPlaceDto {
  const showStreet = l.showStreetAddress && !!l.addressLine1;
  return {
    city: l.city,
    state: l.state ?? null,
    country: l.country,
    postalCode: showStreet ? l.postalCode ?? null : null,
    address: formatAddress(l),
  };
}

@Injectable()
export class ProviderPresenterService {
  constructor(
    @InjectRepository(DiscoveryProvider) private readonly providerRepo: Repository<DiscoveryProvider>,
    @InjectRepository(DiscoveryFavorite) private readonly favoriteRepo: Repository<DiscoveryFavorite>,
    @InjectRepository(DiscoveryProviderMedia) private readonly mediaRepo: Repository<DiscoveryProviderMedia>,
    private readonly handlers: CategoryHandlerRegistry,
  ) {}

  /** Loads providers with the relations a card needs (soft-deleted rows excluded). */
  loadProviders(ids: string[]): Promise<DiscoveryProvider[]> {
    if (!ids.length) return Promise.resolve([]);
    return this.providerRepo.find({
      where: { id: In(ids) },
      relations: { locations: true, languages: true, services: true, categories: { category: true } },
    });
  }

  async favoriteIds(userId: string, providerIds: string[]): Promise<Set<string>> {
    if (!userId || !providerIds.length) return new Set();
    const rows = await this.favoriteRepo.find({
      where: { userId, providerId: In(providerIds) },
      select: { providerId: true },
    });
    return new Set(rows.map((r) => r.providerId));
  }

  primaryCategorySlug(p: DiscoveryProvider): string | null {
    const cats = (p.categories ?? []).filter((c) => !!c.category);
    const primary = cats.find((c) => c.isPrimary) ?? cats[0];
    return primary?.category.slug ?? null;
  }

  /** Cards in the order of `ids` (ids that are missing or not visible are dropped). */
  async toCards(ids: string[], opts: PresentOptions): Promise<ProviderCardDto[]> {
    const providers = (await this.loadProviders(ids)).filter(isProviderVisible);
    const byId = new Map(providers.map((p) => [p.id, p]));
    const favs = await this.favoriteIds(opts.userId, providers.map((p) => p.id));

    // Category detail rows, batched per handler.
    const slugOf = (p: DiscoveryProvider) => opts.categorySlug ?? this.primaryCategorySlug(p) ?? '*';
    const groups = new Map<string, string[]>();
    for (const p of providers) groups.set(slugOf(p), [...(groups.get(slugOf(p)) ?? []), p.id]);
    const details = new Map<string, unknown>();
    for (const [slug, groupIds] of groups) {
      const rows = await this.handlers.for(slug).loadDetails(groupIds);
      rows.forEach((v, k) => details.set(k, v));
    }

    return ids
      .map((id) => byId.get(id))
      .filter((p): p is DiscoveryProvider => !!p)
      .map((p) => this.toCard(p, slugOf(p), details.get(p.id), favs.has(p.id), opts));
  }

  toCard(
    p: DiscoveryProvider,
    categorySlug: string,
    detail: unknown,
    isFavorite: boolean,
    opts: PresentOptions,
  ): ProviderCardDto {
    const locations = (p.locations ?? []).filter((l) => l.isActive);
    const services = (p.services ?? []).filter((s) => s.isActive);

    // Nearest location to the search origin, else the primary one.
    let nearest: DiscoveryLocation | undefined;
    let nearestKm: number | null = null;
    if (opts.origin) {
      for (const l of locations) {
        if (l.latitude === null || l.longitude === null) continue;
        const d = haversineKm(opts.origin, { lat: l.latitude, lng: l.longitude });
        if (nearestKm === null || d < nearestKm) { nearestKm = d; nearest = l; }
      }
    }
    const area = opts.area;
    const areaMatch = area
      ? locations.find((l) =>
          (!area.country || l.country === area.country) &&
          (!area.state || sameText(l.state, area.state)) &&
          (!area.city || sameText(l.city, area.city)))
      : undefined;
    const place = nearest ?? areaMatch ?? locations.find((l) => l.isPrimary) ?? locations[0];

    const priced = services.filter((s) => s.price !== null && s.price !== undefined)
      .sort((a, b) => Number(a.price) - Number(b.price));
    const cheapest = priced[0];

    const modeOrder = Object.values(ConsultationMode);
    const modes = Array.from(new Set(services.map((s) => s.consultationMode)))
      .sort((a, b) => modeOrder.indexOf(a) - modeOrder.indexOf(b));

    return {
      id: p.id,
      categorySlug,
      displayName: p.displayName,
      businessName: p.businessName ?? null,
      headline: p.headline ?? null,
      photoUrl: p.photoUrl ?? null,
      isVerified: p.verificationStatus === ProviderVerificationStatus.VERIFIED,
      acceptingClients: p.acceptingClients,
      rating: {
        average: p.ratingCount > 0 && p.ratingAvg !== null ? Number(p.ratingAvg) : null,
        count: p.ratingCount ?? 0,
      },
      distance: nearestKm !== null ? { value: round1(fromKm(nearestKm, opts.unit)), unit: opts.unit } : null,
      place: place ? toPlace(place) : null,
      locationCount: locations.length,
      languages: (p.languages ?? []).map((l) => l.languageCode).sort(),
      consultationModes: modes,
      startingPrice: cheapest ? { amount: Number(cheapest.price), currency: cheapest.currency ?? 'USD' } : null,
      astrologer: null,
      details: null,
      ...this.handlers.for(categorySlug).toCardExtras(detail),
      isFavorite,
    };
  }

  async toDetail(p: DiscoveryProvider, opts: PresentOptions): Promise<ProviderDetailDto> {
    const slug = opts.categorySlug ?? this.primaryCategorySlug(p) ?? '*';
    const handler = this.handlers.for(slug);
    const [details, favs, media] = await Promise.all([
      handler.loadDetails([p.id]),
      this.favoriteIds(opts.userId, [p.id]),
      this.mediaRepo.find({ where: { providerId: p.id }, order: { displayOrder: 'ASC', createdAt: 'ASC' } }),
    ]);
    const card = this.toCard(p, slug, details.get(p.id), favs.has(p.id), opts);

    const locations: ProviderLocationDto[] = (p.locations ?? [])
      .filter((l) => l.isActive)
      .sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary))
      .map((l) => ({ id: l.id, label: l.label ?? null, isPrimary: l.isPrimary, ...toPlace(l) }));

    return {
      ...card,
      about: p.about ?? null,
      verificationStatus: p.verificationStatus,
      verifiedAt: p.verificationStatus === ProviderVerificationStatus.VERIFIED ? p.verifiedAt : null,
      locations,
      services: (p.services ?? [])
        .filter((s) => s.isActive)
        .sort((a, b) => a.displayOrder - b.displayOrder || a.name.localeCompare(b.name))
        .map((s) => ({
          id: s.id,
          name: s.name,
          specialization: s.specialization ?? null,
          consultationMode: s.consultationMode,
          price: s.price === null || s.price === undefined ? null : Number(s.price),
          currency: s.currency ?? null,
          durationMinutes: s.durationMinutes ?? null,
          description: s.description ?? null,
        })),
      gallery: media.map((m) => ({ id: m.id, url: m.url, caption: m.caption ?? null })),
      astrologerDetail: null,
      serviceDetail: null,
      ...handler.toDetailExtras(details.get(p.id)),
      contactChannels: { phone: !!p.phone, email: !!p.email, website: !!p.website },
      // Admin-maintained listings with no owner can be claimed by the real business.
      claimable: p.managementType !== ManagementType.PROVIDER_MANAGED && !p.userId,
    };
  }
}
