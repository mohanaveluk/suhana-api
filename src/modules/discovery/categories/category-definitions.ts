import { CATEGORY_SLUGS } from '../constants/discovery.constants';

/**
 * Typed, per-category detail schemas for every category except astrologers
 * (which has its own table). Values are stored in discovery_service_details:
 * the shared columns (experience, specialties, hours, certifications) plus an
 * `attributes` JSON object that is validated and coerced against `attributes`
 * here — unknown keys are dropped, so the JSON stays typed.
 *
 * Mirrored in the frontend: features/discover/utils/category-config.ts.
 */
export type AttributeType = 'int' | 'bool' | 'text';

export interface AttributeDef {
  key: string;
  type: AttributeType;
  min?: number;
  max?: number;
  maxLength?: number;
}

export interface CategoryDefinition {
  slug: string;
  /** Allowed specialty codes (venue types, styles, cuisines, …). */
  specialties: readonly string[];
  attributes: readonly AttributeDef[];
  /** Attribute compared by the `minCapacity` search filter (guest capacity), if any. */
  capacityAttribute?: string;
}

export const CATEGORY_DEFINITIONS: readonly CategoryDefinition[] = [
  {
    slug: CATEGORY_SLUGS.MARRIAGE_HALL,
    specialties: ['banquet-hall', 'kalyana-mandapam', 'open-lawn', 'resort', 'temple-hall', 'hotel-ballroom', 'beach-venue'],
    attributes: [
      { key: 'capacityMin', type: 'int', min: 0, max: 100000 },
      { key: 'capacityMax', type: 'int', min: 0, max: 100000 },
      { key: 'roomsAvailable', type: 'int', min: 0, max: 5000 },
      { key: 'parking', type: 'bool' },
      { key: 'airConditioned', type: 'bool' },
      { key: 'inHouseCatering', type: 'bool' },
      { key: 'outsideCateringAllowed', type: 'bool' },
    ],
    capacityAttribute: 'capacityMax',
  },
  {
    slug: CATEGORY_SLUGS.WEDDING_PLANNER,
    specialties: ['full-planning', 'day-of-coordination', 'destination-weddings', 'budget-planning', 'decor-design', 'vendor-management', 'guest-management'],
    attributes: [
      { key: 'eventsPlanned', type: 'int', min: 0, max: 100000 },
      { key: 'teamSize', type: 'int', min: 0, max: 10000 },
      { key: 'travelsForEvents', type: 'bool' },
    ],
  },
  {
    slug: CATEGORY_SLUGS.MATRIMONIAL_CONSULTANT,
    specialties: ['community-matchmaking', 'nri-matches', 'second-marriage', 'horoscope-coordination', 'background-verification', 'family-meetings', 'professionals'],
    attributes: [
      { key: 'communitiesServed', type: 'text', maxLength: 200 },
      { key: 'familyMeetingsArranged', type: 'bool' },
      { key: 'confidentialService', type: 'bool' },
    ],
  },
  {
    slug: CATEGORY_SLUGS.PHOTOGRAPHY,
    specialties: ['candid', 'traditional', 'cinematic-video', 'pre-wedding', 'drone', 'albums', 'live-streaming'],
    attributes: [
      { key: 'teamSize', type: 'int', min: 0, max: 1000 },
      { key: 'deliveryWeeks', type: 'int', min: 0, max: 104 },
      { key: 'travelsForEvents', type: 'bool' },
    ],
  },
  {
    slug: CATEGORY_SLUGS.CATERING_DECORATION,
    specialties: ['vegetarian', 'non-vegetarian', 'south-indian', 'north-indian', 'live-counters', 'floral-decor', 'stage-decor', 'lighting'],
    attributes: [
      { key: 'minGuests', type: 'int', min: 0, max: 100000 },
      { key: 'maxGuests', type: 'int', min: 0, max: 100000 },
      { key: 'tastingAvailable', type: 'bool' },
    ],
    capacityAttribute: 'maxGuests',
  },
  {
    // Shops (service providers). Product catalogues stay a separate, later data model.
    slug: CATEGORY_SLUGS.WEDDING_SHOPPING,
    specialties: ['jewellery', 'bridal-sarees', 'lehengas', 'sherwanis', 'wedding-cards', 'return-gifts', 'accessories'],
    attributes: [
      { key: 'customOrders', type: 'bool' },
      { key: 'alterations', type: 'bool' },
      { key: 'homeTrial', type: 'bool' },
    ],
  },
];

/**
 * Coerces raw input to the category's attribute schema. Unknown keys and
 * empty values are dropped; out-of-range numbers are clamped out (dropped).
 */
export function sanitizeAttributes(def: CategoryDefinition, raw: unknown): Record<string, number | boolean | string> {
  const out: Record<string, number | boolean | string> = {};
  if (!raw || typeof raw !== 'object') return out;
  const src = raw as Record<string, unknown>;
  for (const a of def.attributes) {
    const v = src[a.key];
    if (v === undefined || v === null || v === '') continue;
    if (a.type === 'int') {
      const n = Math.round(Number(v));
      if (!Number.isFinite(n)) continue;
      if ((a.min !== undefined && n < a.min) || (a.max !== undefined && n > a.max)) continue;
      out[a.key] = n;
    } else if (a.type === 'bool') {
      out[a.key] = v === true || v === 'true' || v === 1 || v === '1';
    } else {
      const s = String(v).trim().slice(0, a.maxLength ?? 200);
      if (s) out[a.key] = s;
    }
  }
  return out;
}
