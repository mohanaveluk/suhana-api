import { DiscoverySort } from '../constants/discovery.enums';
import { buildProviderSearchSql, ProviderSearchCriteria } from './provider-search.query';
import { RECOMMENDED_WEIGHTS } from './ranking';

const base = (over: Partial<ProviderSearchCriteria> = {}): ProviderSearchCriteria => ({
  categoryId: 1,
  origin: null,
  radiusKm: null,
  country: null,
  state: null,
  city: null,
  languages: [],
  consultationModes: [],
  minRating: null,
  minPrice: null,
  maxPrice: null,
  verifiedOnly: false,
  q: null,
  sort: DiscoverySort.RECOMMENDED,
  page: 1,
  limit: 12,
  category: { joins: [], joinParams: [], where: [], whereParams: [], experienceExpr: null },
  ...over,
});

const placeholders = (sql: string) => (sql.match(/\?/g) ?? []).length;

describe('buildProviderSearchSql', () => {
  it('binds exactly one value per placeholder in every combination', () => {
    const variants: Partial<ProviderSearchCriteria>[] = [
      {},
      { origin: { lat: 13, lng: 80 }, radiusKm: 40 },
      { origin: { lat: 13, lng: 80 }, radiusKm: null, country: 'IN' },
      { origin: { lat: 10, lng: 179.9 }, radiusKm: 50 }, // antimeridian: no lng filter
      { country: 'IN', state: 'Tamil Nadu', city: 'Chennai' },
      {
        languages: ['ta', 'en'], consultationModes: ['VIDEO'], minRating: 4, minPrice: 100, maxPrice: 900,
        verifiedOnly: true, q: 'iyer',
        category: {
          joins: ['LEFT JOIN discovery_astrologer_details ad ON ad.provider_id = p.id'], joinParams: [],
          where: ['ad.experience_years >= ?'], whereParams: [10], experienceExpr: 'MAX(ad.experience_years)',
        },
      },
    ];
    for (const v of variants) {
      const { page, count } = buildProviderSearchSql(base(v));
      expect(placeholders(page.sql)).toBe(page.params.length);
      expect(placeholders(count.sql)).toBe(count.params.length);
    }
  });

  it('radius search: indexed lat/lng box in WHERE, exact Haversine cut in HAVING', () => {
    const { page } = buildProviderSearchSql(base({ origin: { lat: 13.08, lng: 80.27 }, radiusKm: 40 }));
    expect(page.sql).toContain('l.latitude BETWEEN ? AND ?');
    expect(page.sql).toContain('l.longitude BETWEEN ? AND ?');
    expect(page.sql).toContain('HAVING distance_km <= ?');
    expect(page.sql).toContain('MIN((2 * 6371.0088 * ASIN');
    // origin lat, lat, lng come first (SELECT), radius right before LIMIT/OFFSET
    expect(page.params.slice(0, 3)).toEqual([13.08, 13.08, 80.27]);
    expect(page.params.slice(-3)).toEqual([40, 12, 0]);
  });

  it('"all" radius: distance computed but no box and no HAVING', () => {
    const { page } = buildProviderSearchSql(base({ origin: { lat: 13, lng: 80 }, radiusKm: null }));
    expect(page.sql).toContain('ASIN');
    expect(page.sql).not.toContain('BETWEEN');
    expect(page.sql).not.toContain('HAVING');
  });

  it('area search filters by place text and has no distance', () => {
    const { page } = buildProviderSearchSql(base({ country: 'IN', state: 'Tamil Nadu' }));
    expect(page.sql).toContain('l.country = ?');
    expect(page.sql).toContain('l.state = ?');
    expect(page.sql).toContain('NULL AS distance_km');
    expect(page.params).toEqual(expect.arrayContaining(['IN', 'Tamil Nadu']));
  });

  it('always hides deleted, inactive, rejected and suspended listings', () => {
    const { page } = buildProviderSearchSql(base());
    expect(page.sql).toContain('p.deleted_at IS NULL');
    expect(page.sql).toContain('p.is_active = 1');
    expect(page.sql).toContain('p.verification_status NOT IN (?, ?)');
    expect(page.params).toEqual(expect.arrayContaining(['REJECTED', 'SUSPENDED']));
  });

  it('facets: languages, modes, rating, fee range, verified, name', () => {
    const { page } = buildProviderSearchSql(
      base({ languages: ['ta'], consultationModes: ['VIDEO', 'PHONE'], minRating: 4, minPrice: 500, maxPrice: 1500, verifiedOnly: true, q: '50%_off' }),
    );
    expect(page.sql).toContain('pl.language_code IN (?)');
    expect(page.sql).toContain('sm.consultation_mode IN (?, ?)');
    expect(page.sql).toContain('p.rating_avg >= ?');
    expect(page.sql).toContain('sp.price >= ?');
    expect(page.sql).toContain('sp.price <= ?');
    expect(page.sql).toContain('p.verification_status = ?');
    // LIKE wildcards in user input are escaped
    expect(page.params).toContain('%50\\%\\_off%');
  });

  it('category fragment: joins come before WHERE, its params after the generic ones', () => {
    const { page } = buildProviderSearchSql(
      base({
        country: 'IN',
        category: {
          joins: ['LEFT JOIN discovery_astrologer_details ad ON ad.provider_id = p.id'], joinParams: [],
          where: ['JSON_CONTAINS(ad.specializations, JSON_QUOTE(?))'], whereParams: ['dosha'],
          experienceExpr: 'MAX(ad.experience_years)',
        },
      }),
    );
    expect(page.sql.indexOf('LEFT JOIN discovery_astrologer_details')).toBeLessThan(page.sql.indexOf('WHERE p.deleted_at'));
    expect(page.sql).toContain('MAX(ad.experience_years) AS experience_years');
    const iCountry = page.params.indexOf('IN');
    const iSpec = page.params.indexOf('dosha');
    expect(iCountry).toBeGreaterThan(-1);
    expect(iSpec).toBeGreaterThan(iCountry);
  });

  it.each([
    [DiscoverySort.RECOMMENDED, 'ORDER BY score DESC'],
    [DiscoverySort.NEAREST, 'ORDER BY t.distance_km IS NULL, t.distance_km ASC'],
    [DiscoverySort.RATING, 'ORDER BY t.rating_avg IS NULL, t.rating_avg DESC, t.rating_count DESC'],
    [DiscoverySort.EXPERIENCE, 'ORDER BY t.experience_years IS NULL, t.experience_years DESC'],
    [DiscoverySort.PRICE_ASC, 'ORDER BY t.min_price IS NULL, t.min_price ASC'],
    [DiscoverySort.PRICE_DESC, 'ORDER BY t.min_price IS NULL, t.min_price DESC'],
  ])('sort %s orders deterministically (with name/id tie-breakers)', (sort, expected) => {
    const { page } = buildProviderSearchSql(base({ sort }));
    expect(page.sql).toContain(expected);
    expect(page.sql).toMatch(/t\.display_name ASC, t\.id ASC LIMIT \? OFFSET \?$/);
  });

  it('recommended score uses exactly the documented weights (no paid factor)', () => {
    const { page } = buildProviderSearchSql(base());
    for (const w of Object.values(RECOMMENDED_WEIGHTS)) expect(page.sql).toContain(`${w} *`);
    const sum = Object.values(RECOMMENDED_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 10);
    expect(page.sql.toLowerCase()).not.toMatch(/featured|sponsor|paid/);
  });

  it('paginates in SQL', () => {
    expect(buildProviderSearchSql(base({ page: 3, limit: 10 })).page.params.slice(-2)).toEqual([10, 20]);
    const { count } = buildProviderSearchSql(base({ page: 3, limit: 10 }));
    expect(count.sql).toMatch(/^SELECT COUNT\(\*\) AS total FROM \(/);
    expect(count.sql).not.toContain('LIMIT');
  });
});
