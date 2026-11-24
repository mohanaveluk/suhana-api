import { DistanceUnit, EARTH_RADIUS_KM, KM_PER_MILE } from '../constants/discovery.constants';

export interface LatLng {
  lat: number;
  lng: number;
}

export interface BoundingBox {
  minLat: number;
  maxLat: number;
  /** Null when the box spans the antimeridian or a pole — skip the longitude filter then. */
  minLng: number | null;
  maxLng: number | null;
}

export const toKm = (value: number, unit: DistanceUnit): number => (unit === 'mi' ? value * KM_PER_MILE : value);
export const fromKm = (km: number, unit: DistanceUnit): number => (unit === 'mi' ? km / KM_PER_MILE : km);

const rad = (deg: number) => (deg * Math.PI) / 180;

/** Great-circle distance in km (same formula as the SQL in provider-search.query.ts). */
export function haversineKm(a: LatLng, b: LatLng): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Conservative lat/lng box that contains every point within radiusKm of the
 * origin. Used as an indexed pre-filter; Haversine does the exact cut.
 */
export function boundingBox(origin: LatLng, radiusKm: number): BoundingBox {
  const latDelta = (radiusKm / EARTH_RADIUS_KM) * (180 / Math.PI);
  const minLat = Math.max(-90, origin.lat - latDelta);
  const maxLat = Math.min(90, origin.lat + latDelta);

  // Near a pole every longitude can be within range.
  if (minLat <= -90 || maxLat >= 90) return { minLat, maxLat, minLng: null, maxLng: null };

  const lngDelta = latDelta / Math.cos(rad(origin.lat));
  const minLng = origin.lng - lngDelta;
  const maxLng = origin.lng + lngDelta;
  if (minLng < -180 || maxLng > 180) return { minLat, maxLat, minLng: null, maxLng: null };
  return { minLat, maxLat, minLng, maxLng };
}

/**
 * Coarsens a member-supplied coordinate (2 dp ≈ 1.1 km) so a precise
 * location is never used, echoed back, or logged by us.
 */
export const coarsen = (v: number): number => Math.round(v * 100) / 100;

export const isValidLatLng = (lat: unknown, lng: unknown): boolean =>
  typeof lat === 'number' && typeof lng === 'number' &&
  Number.isFinite(lat) && Number.isFinite(lng) &&
  lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
