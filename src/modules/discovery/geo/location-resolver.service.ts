import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import {
  DISCOVERY_COUNTRIES, DistanceUnit, SUPPORTED_COUNTRY_CODES,
} from '../constants/discovery.constants';
import { GEOCODING_PROVIDER, GeocodingProvider } from './geocoding.provider';
import { coarsen, isValidLatLng, LatLng } from './geo.util';

export interface LocationInput {
  country?: string | null;
  postalCode?: string | null;
  city?: string | null;
  state?: string | null;
  lat?: number | null;
  lng?: number | null;
}

/**
 * Where a search is centred.
 * - point: a coordinate (postal code / city centroid / coarsened browser location) → distance search
 * - area:  a text filter (state, or a city we have no coordinates for) → no distances
 * - none:  no location given → whole directory
 */
export type SearchOrigin =
  | { kind: 'point'; point: LatLng; country: string | null; label: string; source: 'postal' | 'city' | 'device' }
  | { kind: 'area'; country: string | null; state: string | null; city: string | null; label: string }
  | { kind: 'none'; country: null; label: string };

export class InvalidLocationException extends BadRequestException {
  constructor(message: string, code: string) {
    super({ statusCode: 400, message, error: 'Bad Request', code });
  }
}

const clean = (v?: string | null): string | null => {
  const t = (v ?? '').trim().replace(/\s+/g, ' ');
  return t ? t : null;
};

@Injectable()
export class LocationResolverService {
  constructor(@Inject(GEOCODING_PROVIDER) private readonly geocoder: GeocodingProvider) {}

  normaliseCountry(country?: string | null): string | null {
    const c = clean(country)?.toUpperCase() ?? null;
    if (!c) return null;
    if (!SUPPORTED_COUNTRY_CODES.includes(c)) {
      throw new InvalidLocationException(
        `Aurora Discover currently covers ${SUPPORTED_COUNTRY_CODES.map((k) => DISCOVERY_COUNTRIES[k].name).join(' and ')}.`,
        'UNSUPPORTED_COUNTRY',
      );
    }
    return c;
  }

  /** Guess the country from the postal code's shape when the client didn't say. */
  inferCountryFromPostal(postal: string): string | null {
    const digits = postal.replace(/\s/g, '');
    if (DISCOVERY_COUNTRIES.US.postalPattern.test(digits)) return 'US';
    if (DISCOVERY_COUNTRIES.IN.postalPattern.test(digits)) return 'IN';
    return null;
  }

  /** Canonical lookup form: US → 5 digits; IN → 6 digits, spaces removed. */
  normalisePostal(country: string, postal: string): string {
    const cfg = DISCOVERY_COUNTRIES[country];
    const compact = postal.trim().replace(/\s/g, '');
    if (!cfg.postalPattern.test(compact)) {
      throw new InvalidLocationException(
        `"${postal.trim().slice(0, 12)}" is not a valid ${cfg.name} ${cfg.postalLabel}.`,
        'INVALID_POSTAL_CODE',
      );
    }
    return country === 'US' ? compact.slice(0, 5) : compact;
  }

  defaultUnit(country: string | null): DistanceUnit {
    return country ? DISCOVERY_COUNTRIES[country].defaultUnit : 'km';
  }

  async resolve(input: LocationInput): Promise<SearchOrigin> {
    const postal = clean(input.postalCode);
    const city = clean(input.city);
    const state = clean(input.state);
    let country = this.normaliseCountry(input.country);

    // 1. Device location (only ever sent after an explicit click in the UI).
    if (input.lat !== undefined && input.lat !== null && input.lng !== undefined && input.lng !== null) {
      const lat = Number(input.lat);
      const lng = Number(input.lng);
      if (!isValidLatLng(lat, lng)) {
        throw new InvalidLocationException('That location could not be used. Please try a ZIP/PIN code instead.', 'INVALID_COORDINATES');
      }
      return {
        kind: 'point',
        point: { lat: coarsen(lat), lng: coarsen(lng) },
        country,
        label: 'your current location',
        source: 'device',
      };
    }

    // 2. ZIP / PIN code.
    if (postal) {
      country = country ?? this.inferCountryFromPostal(postal);
      if (!country) {
        throw new InvalidLocationException(
          'Enter a 5-digit US ZIP code or a 6-digit India PIN code.',
          'INVALID_POSTAL_CODE',
        );
      }
      const code = this.normalisePostal(country, postal);
      const hit = await this.geocoder.lookupPostalCode(country, code);
      if (!hit) {
        const cfg = DISCOVERY_COUNTRIES[country];
        throw new InvalidLocationException(
          `We couldn't find ${cfg.postalLabel} ${code} in ${cfg.name}. Check the code or search by city instead.`,
          'POSTAL_CODE_NOT_FOUND',
        );
      }
      return { kind: 'point', point: { lat: hit.lat, lng: hit.lng }, country, label: hit.label, source: 'postal' };
    }

    // 3. City (+ optional state).
    if (city) {
      if (!country) {
        throw new InvalidLocationException('Choose a country to search by city.', 'COUNTRY_REQUIRED');
      }
      const hit = await this.geocoder.lookupCity(country, city, state);
      if (hit) {
        return { kind: 'point', point: { lat: hit.lat, lng: hit.lng }, country, label: hit.label, source: 'city' };
      }
      // No coordinates for this city — fall back to matching the listing's city text.
      return {
        kind: 'area', country, state, city,
        label: [city, state, DISCOVERY_COUNTRIES[country].name].filter(Boolean).join(', '),
      };
    }

    // 4. State and/or country only.
    if (state || country) {
      if (!country) {
        throw new InvalidLocationException('Choose a country to search by state.', 'COUNTRY_REQUIRED');
      }
      return {
        kind: 'area', country, state, city: null,
        label: [state, DISCOVERY_COUNTRIES[country].name].filter(Boolean).join(', '),
      };
    }

    return { kind: 'none', country: null, label: 'all locations' };
  }
}
