// How a search intent was ultimately produced. Recorded on every search so the
// AI-fallback rate can be monitored — a rising FALLBACK share means the local
// dictionaries need extending, which is cheaper than paying for inference.
export enum IntentSource {
  /** Local dictionary + fuzzy parser was confident enough on its own. */
  LOCAL = 'LOCAL',
  /** Local parse was below threshold; an LLM produced (or completed) the intent. */
  AI_FALLBACK = 'AI_FALLBACK',
  /** Served from the parsed-intent cache — no parsing or inference ran. */
  CACHE = 'CACHE',
  /** AI fallback was needed but unavailable/failed; the low-confidence local parse was used. */
  LOCAL_DEGRADED = 'LOCAL_DEGRADED',
}

/** Canonical family-structure values, matching Profile.familyType's enum. */
export enum FamilyType {
  JOINT = 'joint',
  NUCLEAR = 'nuclear',
}

/**
 * Canonical family-values values. Distinct from FamilyType: a member can be in a
 * nuclear family yet hold traditional values, and queries like "family oriented"
 * describe values rather than household structure.
 */
export enum FamilyValues {
  TRADITIONAL = 'traditional',
  MODERATE = 'moderate',
  LIBERAL = 'liberal',
}

/** Weights for the intent confidence score. Sums to 100. */
export const CONFIDENCE_WEIGHTS = {
  profession: 30,
  location: 20,
  traits: 20,
  education: 20,
  language: 10,
} as const;

/** Below this, the AI fallback is invoked to complete the intent. */
export const CONFIDENCE_THRESHOLD = 80;

/** Weights for the final match ranking score. Sums to 100. */
export const RANKING_WEIGHTS = {
  profession: 25,
  location: 20,
  education: 15,
  familyValues: 20,
  personality: 10,
  horoscope: 10,
} as const;

/** Which structured facets the parser can populate — drives confidence scoring. */
export enum IntentFacet {
  PROFESSION = 'profession',
  LOCATION = 'location',
  TRAITS = 'traits',
  EDUCATION = 'education',
  LANGUAGE = 'language',
}
