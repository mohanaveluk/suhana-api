import { EARTH_RADIUS_KM } from '../constants/discovery.constants';
import { DiscoverySort, ProviderVerificationStatus, HIDDEN_VERIFICATION_STATUSES } from '../constants/discovery.enums';
import { boundingBox, LatLng } from '../geo/geo.util';
import {
  DISTANCE_REFERENCE_KM, EXPERIENCE_CAP_YEARS, RATING_PRIOR_MEAN, RATING_PRIOR_WEIGHT, RECOMMENDED_WEIGHTS,
} from './ranking';

/** SQL contributed by a category handler (see categories/category-handler.ts). */
export interface CategorySqlFragment {
  joins: string[];
  joinParams: unknown[];
  where: string[];
  whereParams: unknown[];
  /** SQL expression (aggregate-safe) for years of experience, or null if the category has none. */
  experienceExpr: string | null;
}

export interface ProviderSearchCriteria {
  categoryId: number;
  /** Distance origin; null for text-area or whole-directory searches. */
  origin: LatLng | null;
  /** Radius in km; null = no distance limit. Only used with an origin. */
  radiusKm: number | null;
  country: string | null;
  state: string | null;
  city: string | null;
  languages: string[];
  consultationModes: string[];
  minRating: number | null;
  minPrice: number | null;
  maxPrice: number | null;
  verifiedOnly: boolean;
  /** Free-text name filter (display/business name). */
  q: string | null;
  sort: DiscoverySort;
  page: number;
  limit: number;
  category: CategorySqlFragment;
}

export interface BuiltQuery {
  sql: string;
  params: unknown[];
}

export interface ProviderSearchSql {
  page: BuiltQuery;
  count: BuiltQuery;
}

const haversineSql = (latCol: string, lngCol: string) =>
  `(2 * ${EARTH_RADIUS_KM} * ASIN(SQRT(LEAST(1, ` +
  `POW(SIN(RADIANS(${latCol} - ?) / 2), 2) + ` +
  `COS(RADIANS(?)) * COS(RADIANS(${latCol})) * POW(SIN(RADIANS(${lngCol} - ?) / 2), 2)))))`;

const placeholders = (n: number) => Array.from({ length: n }, () => '?').join(', ');

/**
 * Builds the two-stage provider search:
 *
 *   inner  — filters (indexed lat/lng bounding box, category, status, facets),
 *            GROUP BY provider so multi-location providers appear once with
 *            their nearest location's distance, HAVING distance <= radius.
 *   outer  — computes the transparent "recommended" score, sorts with stable
 *            tie-breakers, and paginates (LIMIT/OFFSET) in SQL.
 *
 * Nothing is loaded into memory beyond one page of ids. All values are bound
 * parameters; only fixed identifiers/expressions are interpolated.
 */
export function buildProviderSearchSql(c: ProviderSearchCriteria): ProviderSearchSql {
  const params: unknown[] = [];
  const where: string[] = [
    'p.deleted_at IS NULL',
    'p.is_active = 1',
    `p.verification_status NOT IN (${placeholders(HIDDEN_VERIFICATION_STATUSES.length)})`,
  ];
  const whereParams: unknown[] = [...HIDDEN_VERIFICATION_STATUSES];

  // ── distance ────────────────────────────────────────────────────────────
  let distanceSelect = 'NULL';
  const distanceParams: unknown[] = [];
  if (c.origin) {
    distanceSelect = `MIN(${haversineSql('l.latitude', 'l.longitude')})`;
    distanceParams.push(c.origin.lat, c.origin.lat, c.origin.lng);
    if (c.radiusKm !== null) {
      const box = boundingBox(c.origin, c.radiusKm);
      where.push('l.latitude BETWEEN ? AND ?');
      whereParams.push(box.minLat, box.maxLat);
      if (box.minLng !== null) {
        where.push('l.longitude BETWEEN ? AND ?');
        whereParams.push(box.minLng, box.maxLng);
      }
    }
  }

  // ── place text filters ─────────────────────────────────────────────────
  if (c.country) { where.push('l.country = ?'); whereParams.push(c.country); }
  if (c.state) { where.push('l.state = ?'); whereParams.push(c.state); }
  if (c.city) { where.push('l.city = ?'); whereParams.push(c.city); }

  // ── facets ──────────────────────────────────────────────────────────────
  if (c.verifiedOnly) {
    where.push('p.verification_status = ?');
    whereParams.push(ProviderVerificationStatus.VERIFIED);
  }
  if (c.minRating !== null) {
    where.push('p.rating_avg >= ?');
    whereParams.push(c.minRating);
  }
  if (c.q) {
    where.push('(p.display_name LIKE ? OR p.business_name LIKE ?)');
    const like = `%${c.q.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
    whereParams.push(like, like);
  }
  if (c.languages.length) {
    where.push(
      `EXISTS (SELECT 1 FROM discovery_provider_languages pl WHERE pl.provider_id = p.id AND pl.language_code IN (${placeholders(c.languages.length)}))`,
    );
    whereParams.push(...c.languages);
  }
  if (c.consultationModes.length) {
    where.push(
      `EXISTS (SELECT 1 FROM discovery_services sm WHERE sm.provider_id = p.id AND sm.is_active = 1 AND sm.consultation_mode IN (${placeholders(c.consultationModes.length)}))`,
    );
    whereParams.push(...c.consultationModes);
  }
  if (c.minPrice !== null || c.maxPrice !== null) {
    // "Has at least one published fee in range."
    const conds = ['sp.provider_id = p.id', 'sp.is_active = 1', 'sp.price IS NOT NULL'];
    if (c.minPrice !== null) { conds.push('sp.price >= ?'); whereParams.push(c.minPrice); }
    if (c.maxPrice !== null) { conds.push('sp.price <= ?'); whereParams.push(c.maxPrice); }
    where.push(`EXISTS (SELECT 1 FROM discovery_services sp WHERE ${conds.join(' AND ')})`);
  }

  // ── category-specific ───────────────────────────────────────────────────
  where.push(...c.category.where);
  const experienceSelect = c.category.experienceExpr ?? 'NULL';

  const havingParams: unknown[] = [];
  const having: string[] = [];
  if (c.origin && c.radiusKm !== null) {
    having.push('distance_km <= ?');
    havingParams.push(c.radiusKm);
  }

  const inner =
    `SELECT p.id AS id, p.display_name AS display_name, ` +
    `${distanceSelect} AS distance_km, ` +
    `MAX(p.rating_avg) AS rating_avg, MAX(p.rating_count) AS rating_count, ` +
    `MAX(CASE WHEN p.verification_status = '${ProviderVerificationStatus.VERIFIED}' THEN 1 ELSE 0 END) AS is_verified, ` +
    `MAX(CASE WHEN p.accepting_clients = 1 THEN 1 ELSE 0 END) AS accepting, ` +
    `${experienceSelect} AS experience_years, ` +
    `(SELECT MIN(s.price) FROM discovery_services s WHERE s.provider_id = p.id AND s.is_active = 1 AND s.price IS NOT NULL) AS min_price ` +
    `FROM discovery_providers p ` +
    `INNER JOIN discovery_provider_categories pc ON pc.provider_id = p.id AND pc.category_id = ? ` +
    `INNER JOIN discovery_locations l ON l.provider_id = p.id AND l.is_active = 1 ` +
    c.category.joins.map((j) => `${j} `).join('') +
    `WHERE ${where.join(' AND ')} ` +
    `GROUP BY p.id, p.display_name` +
    (having.length ? ` HAVING ${having.join(' AND ')}` : '');

  // Parameter order must follow placeholder order in the SQL text:
  // SELECT (distance) → JOIN (category) → category joins → WHERE → HAVING.
  // Category where-clauses are appended after the generic ones, so their params come last in WHERE.
  const innerParams = [
    ...distanceParams, c.categoryId, ...c.category.joinParams, ...whereParams, ...c.category.whereParams, ...havingParams,
  ];

  const refKm = c.radiusKm ?? DISTANCE_REFERENCE_KM;
  const w = RECOMMENDED_WEIGHTS;
  const score =
    `(${w.distance} * (CASE WHEN t.distance_km IS NULL THEN 0.5 ELSE GREATEST(0, 1 - t.distance_km / ${refKm}) END)` +
    ` + ${w.rating} * (((COALESCE(t.rating_count, 0) * COALESCE(t.rating_avg, 0)) + ${RATING_PRIOR_WEIGHT * RATING_PRIOR_MEAN}) / (COALESCE(t.rating_count, 0) + ${RATING_PRIOR_WEIGHT}) / 5)` +
    ` + ${w.reviewCount} * LEAST(1, LOG10(1 + COALESCE(t.rating_count, 0)) / 2)` +
    ` + ${w.experience} * LEAST(1, COALESCE(t.experience_years, 0) / ${EXPERIENCE_CAP_YEARS})` +
    ` + ${w.verification} * t.is_verified` +
    ` + ${w.availability} * t.accepting)`;

  const tie = 't.display_name ASC, t.id ASC';
  const orderBy: Record<DiscoverySort, string> = {
    [DiscoverySort.RECOMMENDED]: `score DESC, ${tie}`,
    [DiscoverySort.NEAREST]: `t.distance_km IS NULL, t.distance_km ASC, ${tie}`,
    [DiscoverySort.RATING]: `t.rating_avg IS NULL, t.rating_avg DESC, t.rating_count DESC, ${tie}`,
    [DiscoverySort.EXPERIENCE]: `t.experience_years IS NULL, t.experience_years DESC, ${tie}`,
    [DiscoverySort.PRICE_ASC]: `t.min_price IS NULL, t.min_price ASC, ${tie}`,
    [DiscoverySort.PRICE_DESC]: `t.min_price IS NULL, t.min_price DESC, ${tie}`,
  };

  const offset = (c.page - 1) * c.limit;
  const pageSql =
    `SELECT t.id, t.distance_km, t.min_price, t.experience_years, ${score} AS score ` +
    `FROM (${inner}) t ORDER BY ${orderBy[c.sort]} LIMIT ? OFFSET ?`;

  return {
    page: { sql: pageSql, params: [...innerParams, c.limit, offset] },
    count: { sql: `SELECT COUNT(*) AS total FROM (${inner}) t`, params: [...innerParams] },
  };
}
