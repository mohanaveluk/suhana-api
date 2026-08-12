import { IntentSource } from '../enums/search.enums';

/**
 * The structured form of a natural-language query.
 *
 * Every field is optional: a query only ever constrains a few facets, and an
 * absent field means "no constraint" rather than "no match". Values are always
 * canonical (post-synonym, post-fuzzy) so the query builder never has to guess.
 */
export interface SearchIntent {
  profession?: string;
  education?: string;
  religion?: string;
  caste?: string;
  city?: string;
  state?: string;
  country?: string;
  ageMin?: number;
  ageMax?: number;
  /** Canonical MaritalStatus value — "Never Married", "Divorced", ... */
  maritalStatus?: string;
  /**
   * "second marriage", "open to divorcee". Widens the status filter to every
   * previously-married state rather than pinning it to one.
   */
  openToRemarriage?: boolean;
  languages?: string[];
  personalityTraits?: string[];
  interests?: string[];
  familyType?: string;
  /** Canonical family-values bucket: traditional | moderate | liberal. */
  familyValues?: string;
  willingToRelocate?: boolean;
  horoscopeRequired?: boolean;
  /** Gender being searched *for* — 'bride' | 'groom'. */
  gender?: string;

  // ── Matrimony-specific intents beyond the base filter set ────────────────
  /** "verified members", "premium members" */
  premiumOnly?: boolean;
  verifiedOnly?: boolean;
  /** "active in the last 7 days" → 7 */
  activeWithinDays?: number;
  /** "85%+ AI match score" → 85 */
  minMatchScore?: number;
  /** "similar to my shortlisted profiles" */
  similarToShortlisted?: boolean;
  /** "profiles similar to Nandhini" — resolved downstream. */
  similarToName?: string;
  /** "matches my parents would approve" — implies traditional + horoscope weighting. */
  familyApproval?: boolean;

  /** Residual tokens that matched no dictionary; used for free-text LIKE search. */
  keywords?: string[];
}

/** A parsed intent plus the metadata describing how it was obtained. */
export interface ParsedIntentResult {
  intent: SearchIntent;
  confidence: number;
  source: IntentSource;
  /** Facet-by-facet contribution to the confidence score, for debugging/tuning. */
  matchedFacets: string[];
  /** Terms the fuzzy matcher corrected, e.g. { docotr: 'Doctor' }. */
  corrections: Record<string, string>;
  /** Populated when the AI fallback ran and failed. */
  fallbackError?: string;
}
