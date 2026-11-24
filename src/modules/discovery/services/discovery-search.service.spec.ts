import { NotFoundException } from '@nestjs/common';
import { DiscoverySearchService } from './discovery-search.service';
import { CategoryComingSoonException } from './discovery-catalog.service';
import { LocationResolverService } from '../geo/location-resolver.service';
import { GeocodingProvider } from '../geo/geocoding.provider';
import { CategoryHandlerRegistry } from '../categories/category-handler.registry';
import { AstrologerCategoryHandler } from '../categories/astrologer-category.handler';
import { GenericCategoryHandler } from '../categories/generic-category.handler';
import { DiscoverySort, ProviderVerificationStatus } from '../constants/discovery.enums';
import { KM_PER_MILE } from '../constants/discovery.constants';

const ASTRO = { id: 1, slug: 'astrologer', name: 'Astrologers', isActive: true };

describe('DiscoverySearchService', () => {
  let dataSource: { query: jest.Mock };
  let catalog: { requireActiveCategory: jest.Mock };
  let geocoder: jest.Mocked<GeocodingProvider>;
  let presenter: { toCards: jest.Mock; loadProviders: jest.Mock; toDetail: jest.Mock };
  let svc: DiscoverySearchService;

  /** Rows returned by the page query, and the total for the count query. */
  const respond = (ids: string[], total = ids.length) =>
    dataSource.query.mockImplementation(async (sql: string) =>
      sql.startsWith('SELECT COUNT(*)') ? [{ total: String(total) }] : ids.map((id) => ({ id })),
    );
  const pageCall = () => dataSource.query.mock.calls.find(([sql]) => !sql.startsWith('SELECT COUNT(*)'))!;

  beforeEach(() => {
    dataSource = { query: jest.fn() };
    catalog = { requireActiveCategory: jest.fn().mockResolvedValue(ASTRO) };
    geocoder = { lookupPostalCode: jest.fn(), lookupCity: jest.fn() };
    presenter = {
      toCards: jest.fn(async (ids: string[]) => ids.map((id) => ({ id }))),
      loadProviders: jest.fn(),
      toDetail: jest.fn(async (p) => ({ id: p.id })),
    };
    const handlers = new CategoryHandlerRegistry(
      new AstrologerCategoryHandler({ find: jest.fn().mockResolvedValue([]) } as any),
      new GenericCategoryHandler(),
    );
    svc = new DiscoverySearchService(
      dataSource as any, {} as any, catalog as any, new LocationResolverService(geocoder), handlers, presenter as any,
    );
  });

  it('search by US ZIP: miles by default, radius converted to km for SQL', async () => {
    geocoder.lookupPostalCode.mockResolvedValue({ lat: 40.5, lng: -74.4, label: 'Edison, New Jersey 08817', country: 'US', state: 'New Jersey', city: 'Edison', postalCode: '08817' });
    respond(['a', 'b']);
    const res = await svc.search('astrologer', { postalCode: '08817', radius: '10' }, 'u1');
    expect(res.origin).toEqual({ type: 'point', label: 'Edison, New Jersey 08817', country: 'US', unit: 'mi', radius: 10 });
    const [, params] = pageCall();
    expect(params).toContain(10 * KM_PER_MILE); // HAVING radius in km
    expect(res.items.map((i) => i.id)).toEqual(['a', 'b']);
    expect(presenter.toCards).toHaveBeenCalledWith(['a', 'b'], expect.objectContaining({ userId: 'u1', unit: 'mi', origin: { lat: 40.5, lng: -74.4 } }));
  });

  it('search by India PIN: km by default; unit can be switched to miles', async () => {
    geocoder.lookupPostalCode.mockResolvedValue({ lat: 13.08, lng: 80.27, label: 'Chennai', country: 'IN', state: null, city: null, postalCode: '600001' });
    respond([]);
    const km = await svc.search('astrologer', { postalCode: '600001', radius: '25' }, 'u1');
    expect(km.origin.unit).toBe('km');
    expect(pageCall()[1]).toContain(25);
    dataSource.query.mockClear();
    respond([]);
    const mi = await svc.search('astrologer', { postalCode: '600001', radius: '25', unit: 'mi' }, 'u1');
    expect(mi.origin.unit).toBe('mi');
    expect(pageCall()[1]).toContain(25 * KM_PER_MILE);
  });

  it('search by city resolves a centroid and searches by distance', async () => {
    geocoder.lookupCity.mockResolvedValue({ lat: 13.06, lng: 80.25, label: 'Chennai, Tamil Nadu', country: 'IN', state: 'Tamil Nadu', city: 'Chennai', postalCode: null });
    respond(['x']);
    const res = await svc.search('astrologer', { city: 'Chennai', country: 'IN' }, 'u1');
    expect(res.origin.type).toBe('point');
    expect(res.origin.radius).toBe(25); // default radius
    expect(pageCall()[0]).toContain('BETWEEN');
  });

  it('search by country + state filters by text (no distance, radius ignored)', async () => {
    respond(['x']);
    const res = await svc.search('astrologer', { country: 'IN', state: 'Tamil Nadu', radius: '5' }, 'u1');
    expect(res.origin).toMatchObject({ type: 'area', radius: null, unit: 'km' });
    const [sql, params] = pageCall();
    expect(sql).not.toContain('BETWEEN');
    expect(params).toEqual(expect.arrayContaining(['IN', 'Tamil Nadu']));
  });

  it('radius "all" with a point origin: no distance limit', async () => {
    geocoder.lookupPostalCode.mockResolvedValue({ lat: 13, lng: 80, label: 'X', country: 'IN', state: null, city: null, postalCode: '600001' });
    respond([]);
    const res = await svc.search('astrologer', { postalCode: '600001', radius: 'all' }, 'u1');
    expect(res.origin.radius).toBeNull();
    expect(pageCall()[0]).not.toContain('HAVING');
  });

  it('no results → empty page with totalPages 1', async () => {
    respond([], 0);
    const res = await svc.search('astrologer', { country: 'US' }, 'u1');
    expect(res).toMatchObject({ items: [], total: 0, page: 1, totalPages: 1 });
  });

  it('invalid postal code → 400 before any SQL runs', async () => {
    await expect(svc.search('astrologer', { postalCode: '12' }, 'u1')).rejects.toMatchObject({ status: 400 });
    expect(dataSource.query).not.toHaveBeenCalled();
  });

  it('passes astrologer filters through the category handler', async () => {
    respond([]);
    await svc.search('astrologer', { country: 'IN', specialization: ['dosha', 'manglik'], minExperience: 10, language: ['ta'] }, 'u1');
    const [sql, params] = pageCall();
    expect(sql).toContain('JSON_CONTAINS(ad.specializations, JSON_QUOTE(?)) OR JSON_CONTAINS');
    expect(sql).toContain('ad.experience_years >= ?');
    expect(params).toEqual(expect.arrayContaining(['dosha', 'manglik', 10, 'ta']));
  });

  it('fee filter needs a country (currencies differ)', async () => {
    await expect(svc.search('astrologer', { maxPrice: 1000 }, 'u1')).rejects.toMatchObject({ status: 400 });
  });

  it.each([
    [DiscoverySort.RATING, { country: 'IN' }, DiscoverySort.RATING],
    [DiscoverySort.EXPERIENCE, { country: 'IN' }, DiscoverySort.EXPERIENCE],
    [DiscoverySort.PRICE_ASC, { country: 'IN' }, DiscoverySort.PRICE_ASC],
    [DiscoverySort.PRICE_DESC, { country: 'IN' }, DiscoverySort.PRICE_DESC],
    [DiscoverySort.PRICE_ASC, {}, DiscoverySort.RECOMMENDED], // no country → fallback
    [DiscoverySort.NEAREST, { country: 'IN' }, DiscoverySort.RECOMMENDED], // no point → fallback
    [DiscoverySort.RECOMMENDED, {}, DiscoverySort.RECOMMENDED],
  ])('sort %s with %j → applied %s, explained', async (sortBy, loc, applied) => {
    respond([]);
    const res = await svc.search('astrologer', { ...loc, sortBy }, 'u1');
    expect(res.ranking.requested).toBe(sortBy);
    expect(res.ranking.applied).toBe(applied);
    expect(res.ranking.description.length).toBeGreaterThan(10);
    if (applied !== sortBy) expect(res.ranking.notice).toBeTruthy();
    if (applied === DiscoverySort.RECOMMENDED) expect(res.ranking.factors).toBeDefined();
  });

  it('nearest is honoured when there is a point origin', async () => {
    geocoder.lookupPostalCode.mockResolvedValue({ lat: 13, lng: 80, label: 'X', country: 'IN', state: null, city: null, postalCode: '600001' });
    respond([]);
    const res = await svc.search('astrologer', { postalCode: '600001', sortBy: DiscoverySort.NEAREST }, 'u1');
    expect(res.ranking.applied).toBe(DiscoverySort.NEAREST);
    expect(pageCall()[0]).toContain('ORDER BY t.distance_km IS NULL');
  });

  it('pagination: page/limit flow into LIMIT/OFFSET and totalPages', async () => {
    respond(['p'], 23);
    const res = await svc.search('astrologer', { country: 'US', page: 3, limit: 5 }, 'u1');
    expect(pageCall()[1].slice(-2)).toEqual([5, 10]);
    expect(res).toMatchObject({ page: 3, limit: 5, total: 23, totalPages: 5 });
  });

  it('coming-soon category → 404 with a clear message', async () => {
    catalog.requireActiveCategory.mockRejectedValue(new CategoryComingSoonException('Marriage Halls'));
    await expect(svc.search('marriage-hall', {}, 'u1')).rejects.toThrow(/coming soon/);
  });

  // ── details ─────────────────────────────────────────────────────────────

  const provider = (over: any = {}) => ({
    id: 'p1', isActive: true, deletedAt: null, verificationStatus: ProviderVerificationStatus.VERIFIED,
    phone: '+91 1', email: 'a@b.c', website: null,
    categories: [{ isPrimary: true, category: { slug: 'astrologer', isActive: true } }],
    locations: [{ isPrimary: true, country: 'IN' }],
    ...over,
  });

  it('details: visible astrologer → presenter detail in km for India', async () => {
    presenter.loadProviders.mockResolvedValue([provider()]);
    await svc.getProvider('p1', 'u1', { categorySlug: 'astrologer' });
    expect(presenter.toDetail).toHaveBeenCalledWith(expect.objectContaining({ id: 'p1' }), expect.objectContaining({ unit: 'km', userId: 'u1' }));
  });

  it.each([
    ['missing', []],
    ['inactive', [provider({ isActive: false })]],
    ['rejected', [provider({ verificationStatus: ProviderVerificationStatus.REJECTED })]],
    ['suspended', [provider({ verificationStatus: ProviderVerificationStatus.SUSPENDED })]],
    ['other category', [provider({ categories: [{ isPrimary: true, category: { slug: 'photography', isActive: true } }] })]],
  ])('details: %s listing → 404', async (_label, rows) => {
    presenter.loadProviders.mockResolvedValue(rows);
    await expect(svc.getProvider('p1', 'u1', { categorySlug: 'astrologer' })).rejects.toBeInstanceOf(NotFoundException);
  });

  it('contact: only for visible listings, returns the stored channels', async () => {
    presenter.loadProviders.mockResolvedValue([provider()]);
    await expect(svc.getContact('p1')).resolves.toEqual({ phone: '+91 1', email: 'a@b.c', website: null });
    presenter.loadProviders.mockResolvedValue([provider({ verificationStatus: ProviderVerificationStatus.SUSPENDED })]);
    await expect(svc.getContact('p1')).rejects.toBeInstanceOf(NotFoundException);
  });
});
