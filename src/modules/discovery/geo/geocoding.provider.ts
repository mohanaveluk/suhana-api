import { LatLng } from './geo.util';

export interface GeocodeResult extends LatLng {
  /** Human label, e.g. "Chennai, Tamil Nadu 600001". */
  label: string;
  country: string;
  state: string | null;
  city: string | null;
  postalCode: string | null;
}

/**
 * Pluggable geocoder (CLAUDE.md convention 9). The default implementation reads
 * the locally imported GeoNames table — no network, no API key. A hosted
 * geocoder (Google, Mapbox, …) can be bound to this token later, with its key
 * from env/Secret Manager.
 */
export interface GeocodingProvider {
  /** Postal code centroid, or null when the code is unknown. Input is already normalised. */
  lookupPostalCode(country: string, postalCode: string): Promise<GeocodeResult | null>;
  /** City centroid (optionally constrained to a state), or null when unknown. */
  lookupCity(country: string, city: string, state?: string | null): Promise<GeocodeResult | null>;
}

export const GEOCODING_PROVIDER = Symbol('GEOCODING_PROVIDER');
