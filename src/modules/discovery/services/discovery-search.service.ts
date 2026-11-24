import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import {
  DISCOVERY_PAGE_SIZE_DEFAULT, DistanceUnit,
} from '../constants/discovery.constants';
import { DiscoverySort } from '../constants/discovery.enums';
import { DiscoveryProvider } from '../entities/discovery-provider.entity';
import {
  AstrologerSearchQueryDto, ProviderCardDto, ProviderSearchResponseDto, RankingInfoDto,
} from '../dto/discovery-search.dto';
import { ProviderContactDto, ProviderDetailDto } from '../dto/discovery-detail.dto';
import { InvalidLocationException, LocationResolverService, SearchOrigin } from '../geo/location-resolver.service';
import { fromKm, toKm } from '../geo/geo.util';
import { buildProviderSearchSql } from '../search/provider-search.query';
import { RECOMMENDED_WEIGHTS, SORT_DESCRIPTIONS } from '../search/ranking';
import { CategoryHandlerRegistry } from '../categories/category-handler.registry';
import { DiscoveryCatalogService } from './discovery-catalog.service';
import { isProviderVisible, ProviderPresenterService } from './provider-presenter.service';

const DEFAULT_RADIUS = '25';

@Injectable()
export class DiscoverySearchService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(DiscoveryProvider) private readonly providerRepo: Repository<DiscoveryProvider>,
    private readonly catalog: DiscoveryCatalogService,
    private readonly locations: LocationResolverService,
    private readonly handlers: CategoryHandlerRegistry,
    private readonly presenter: ProviderPresenterService,
  ) {}

  /**
   * Category search. Category-specific filters (specialization, minExperience)
   * are read by the category's handler; unrelated ones are ignored.
   */
  async search(categorySlug: string, q: AstrologerSearchQueryDto, userId: string): Promise<ProviderSearchResponseDto> {
    const category = await this.catalog.requireActiveCategory(categorySlug);
    const handler = this.handlers.for(category.slug);
    const origin = await this.locations.resolve(q);

    const country = origin.country;
    const unit: DistanceUnit = q.unit ?? this.locations.defaultUnit(country);
    const radiusParam = q.radius ?? DEFAULT_RADIUS;
    const radiusInUnit = origin.kind === 'point' && radiusParam !== 'all' ? Number(radiusParam) : null;
    const radiusKm = radiusInUnit !== null ? toKm(radiusInUnit, unit) : null;

    // Sort: fall back transparently when the requested order can't apply.
    // Fees are compared numerically, so they only make sense within one country/currency.
    if ((q.minPrice !== undefined || q.maxPrice !== undefined) && !country) {
      throw new InvalidLocationException('Choose a country to filter by fee.', 'COUNTRY_REQUIRED');
    }
    const requested = q.sortBy ?? DiscoverySort.RECOMMENDED;
    let applied = requested;
    let notice: string | null = null;
    const isPriceSort = requested === DiscoverySort.PRICE_ASC || requested === DiscoverySort.PRICE_DESC;
    if (requested === DiscoverySort.NEAREST && origin.kind !== 'point') {
      applied = DiscoverySort.RECOMMENDED;
      notice = 'Enter a ZIP/PIN code, a city, or use your location to sort by distance.';
    } else if (isPriceSort && !country) {
      applied = DiscoverySort.RECOMMENDED;
      notice = 'Choose a country to sort by fee (fees are listed in local currency).';
    } else if (!handler.supportedSorts.includes(requested)) {
      applied = DiscoverySort.RECOMMENDED;
      notice = 'That sort is not available for this category.';
    }

    const page = q.page ?? 1;
    const limit = q.limit ?? DISCOVERY_PAGE_SIZE_DEFAULT;

    const sql = buildProviderSearchSql({
      categoryId: category.id,
      origin: origin.kind === 'point' ? origin.point : null,
      radiusKm,
      country: origin.kind === 'none' ? null : country,
      state: origin.kind === 'area' ? origin.state : null,
      city: origin.kind === 'area' ? origin.city : null,
      languages: q.language ?? [],
      consultationModes: q.consultationMode ?? [],
      minRating: q.minRating ?? null,
      minPrice: q.minPrice ?? null,
      maxPrice: q.maxPrice ?? null,
      verifiedOnly: q.verifiedOnly === true,
      q: q.q?.trim() || null,
      sort: applied,
      page,
      limit,
      category: handler.searchFragment({
        specialization: q.specialization, minExperience: q.minExperience, minCapacity: q.minCapacity,
      }),
    });

    const [rows, countRows] = await Promise.all([
      this.dataSource.query(sql.page.sql, sql.page.params) as Promise<Array<{ id: string }>>,
      this.dataSource.query(sql.count.sql, sql.count.params) as Promise<Array<{ total: string | number }>>,
    ]);
    const total = Number(countRows?.[0]?.total ?? 0);

    const items: ProviderCardDto[] = await this.presenter.toCards(rows.map((r) => r.id), {
      userId,
      categorySlug: category.slug,
      origin: origin.kind === 'point' ? origin.point : null,
      area: origin.kind === 'area' ? { country: origin.country, state: origin.state, city: origin.city } : null,
      unit,
    });

    const ranking: RankingInfoDto = {
      requested,
      applied,
      description: SORT_DESCRIPTIONS[applied],
      notice,
      ...(applied === DiscoverySort.RECOMMENDED ? { factors: { ...RECOMMENDED_WEIGHTS } } : {}),
    };

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      origin: this.describeOrigin(origin, unit, radiusInUnit),
      ranking,
    };
  }

  private describeOrigin(origin: SearchOrigin, unit: DistanceUnit, radius: number | null) {
    return {
      type: origin.kind,
      label: origin.label,
      country: origin.country,
      unit,
      radius: origin.kind === 'point' ? radius : null,
    };
  }

  /** Visible provider, optionally required to be listed in `categorySlug`. */
  async findVisibleProvider(id: string, categorySlug?: string): Promise<DiscoveryProvider> {
    const [p] = await this.presenter.loadProviders([id]);
    if (!isProviderVisible(p ?? null)) throw new NotFoundException('Listing not found');
    if (categorySlug) {
      const inCategory = (p.categories ?? []).some((c) => c.category?.slug === categorySlug && c.category.isActive);
      if (!inCategory) throw new NotFoundException('Listing not found');
    } else if (!(p.categories ?? []).some((c) => c.category?.isActive)) {
      // Listings only in "coming soon" categories aren't public yet.
      throw new NotFoundException('Listing not found');
    }
    return p;
  }

  async getProvider(
    id: string,
    userId: string,
    opts: { categorySlug?: string; unit?: DistanceUnit; lat?: number; lng?: number; postalCode?: string; country?: string } = {},
  ): Promise<ProviderDetailDto> {
    const p = await this.findVisibleProvider(id, opts.categorySlug);
    // Optional origin so the detail page can show "x mi away" consistently with the list.
    let origin: SearchOrigin | null = null;
    if ((opts.lat !== undefined && opts.lng !== undefined) || opts.postalCode) {
      origin = await this.locations.resolve({ lat: opts.lat, lng: opts.lng, postalCode: opts.postalCode, country: opts.country })
        .catch(() => null);
    }
    const country = origin?.country ?? p.locations?.find((l) => l.isPrimary)?.country ?? p.locations?.[0]?.country ?? null;
    const unit = opts.unit ?? this.locations.defaultUnit(country);
    return this.presenter.toDetail(p, {
      userId,
      categorySlug: opts.categorySlug ?? null,
      origin: origin?.kind === 'point' ? origin.point : null,
      unit,
    });
  }

  /** Contact details are released one listing at a time (rate-limited at the controller). */
  async getContact(id: string): Promise<ProviderContactDto> {
    const p = await this.findVisibleProvider(id);
    return { phone: p.phone ?? null, email: p.email ?? null, website: p.website ?? null };
  }

  /** Exposed for tests/docs: convert a km distance for display. */
  static displayDistance(km: number, unit: DistanceUnit): number {
    return Math.round(fromKm(km, unit) * 10) / 10;
  }
}
