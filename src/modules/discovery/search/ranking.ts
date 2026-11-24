import { DiscoverySort } from '../constants/discovery.enums';

/**
 * "Recommended" ordering — transparent, documented, and returned to clients in
 * every search response so the UI can explain it. Weights sum to 1.
 *
 * Paid / featured placement is deliberately NOT a factor and must never be
 * added here: sponsored results (a later release) will be a separately
 * labelled slot, outside organic ranking.
 */
export const RECOMMENDED_WEIGHTS = {
  /** 1 at the search centre, falling linearly to 0 at the radius (100 km when unbounded). Neutral 0.5 without a location. */
  distance: 0.3,
  /** Bayesian average of APPROVED review ratings (prior 3.5★ weighted as 5 reviews), scaled 0–1. */
  rating: 0.25,
  /** log10(1 + approved review count) / 2, capped at 1 (100 reviews → 1). */
  reviewCount: 0.1,
  /** Years of experience / 30, capped at 1. Categories without experience score 0. */
  experience: 0.15,
  /** 1 when the business listing is VERIFIED by Aurora, else 0. */
  verification: 0.15,
  /** 1 when the provider is currently accepting new clients, else 0. */
  availability: 0.05,
} as const;

export const RATING_PRIOR_MEAN = 3.5;
export const RATING_PRIOR_WEIGHT = 5;
export const DISTANCE_REFERENCE_KM = 100;
export const EXPERIENCE_CAP_YEARS = 30;

export const SORT_DESCRIPTIONS: Record<DiscoverySort, string> = {
  [DiscoverySort.RECOMMENDED]:
    'Balances distance, rating, number of reviews, experience, Aurora listing verification and availability. Paid placement never affects this order.',
  [DiscoverySort.NEAREST]: 'Closest first, by straight-line distance to the nearest listed location.',
  [DiscoverySort.RATING]: 'Highest average rating from approved member reviews first; unrated listings last.',
  [DiscoverySort.EXPERIENCE]: 'Most years of experience first; listings without this information last.',
  [DiscoverySort.PRICE_ASC]: 'Lowest starting fee first; listings without published fees last.',
  [DiscoverySort.PRICE_DESC]: 'Highest starting fee first; listings without published fees last.',
};
