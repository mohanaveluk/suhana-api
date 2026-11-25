/**
 * Aurora Discover — shared constants.
 *
 * Country support is data-driven: adding a market means adding one entry to
 * DISCOVERY_COUNTRIES (plus importing its postal codes, see docs/aurora-discover.md).
 */
export type DistanceUnit = 'mi' | 'km';

export interface DiscoveryCountryConfig {
  code: string; // ISO 3166-1 alpha-2
  name: string;
  defaultUnit: DistanceUnit;
  currency: string; // ISO 4217
  postalLabel: string; // "ZIP code" / "PIN code"
  postalPattern: RegExp;
}

export const DISCOVERY_COUNTRIES: Record<string, DiscoveryCountryConfig> = {
  US: {
    code: 'US',
    name: 'United States',
    defaultUnit: 'mi',
    currency: 'USD',
    postalLabel: 'ZIP code',
    // 5-digit ZIP, optional ZIP+4 (only the first 5 digits are used for lookup).
    postalPattern: /^\d{5}(-\d{4})?$/,
  },
  IN: {
    code: 'IN',
    name: 'India',
    defaultUnit: 'km',
    currency: 'INR',
    postalLabel: 'PIN code',
    // 6 digits, first digit 1–9.
    postalPattern: /^[1-9]\d{5}$/,
  },
};

export const SUPPORTED_COUNTRY_CODES = Object.keys(DISCOVERY_COUNTRIES);

/** Allowed search radii (in the request's unit). 'all' = no distance limit. */
export const RADIUS_OPTIONS = [5, 10, 25, 50, 100] as const;

export const KM_PER_MILE = 1.609344;
export const EARTH_RADIUS_KM = 6371.0088;

export const DISCOVERY_PAGE_SIZE_DEFAULT = 12;
export const DISCOVERY_PAGE_SIZE_MAX = 50;

/** Category slugs. Only ASTROLOGER is active in Phase 1. */
export const CATEGORY_SLUGS = {
  ASTROLOGER: 'astrologer',
  MARRIAGE_HALL: 'marriage-hall',
  WEDDING_PLANNER: 'wedding-planner',
  MATRIMONIAL_CONSULTANT: 'matrimonial-consultant',
  PHOTOGRAPHY: 'photography',
  CATERING_DECORATION: 'catering-decoration',
  WEDDING_SHOPPING: 'wedding-shopping',
  MEHNDI_ARTIST: 'mehndi-artist',
} as const;

/** Astrologer specializations (stable codes; labels live in the frontend). */
export const ASTROLOGER_SPECIALIZATIONS = [
  'kundli',
  'horoscope-matching',
  'dosha',
  'manglik',
  'muhurtham',
  'nadi',
  'numerology',
  'vastu',
  'palmistry',
  'prashna',
] as const;
export type AstrologerSpecialization = (typeof ASTROLOGER_SPECIALIZATIONS)[number];

/** ISO 639-1 codes accepted for provider languages. */
export const DISCOVERY_LANGUAGES = [
  'en', 'hi', 'ta', 'te', 'kn', 'ml', 'mr', 'gu', 'bn', 'pa', 'or', 'ur', 'sa', 'kok', 'as',
] as const;

export const WEEK_DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
