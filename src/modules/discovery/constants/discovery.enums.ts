/** Values are stored verbatim (varchar columns) — keep them stable. */
export enum ProviderVerificationStatus {
  PENDING = 'PENDING',
  VERIFIED = 'VERIFIED',
  REJECTED = 'REJECTED',
  SUSPENDED = 'SUSPENDED',
}

/** Providers in these states never appear in member-facing results. */
export const HIDDEN_VERIFICATION_STATUSES = [
  ProviderVerificationStatus.REJECTED,
  ProviderVerificationStatus.SUSPENDED,
];

export enum DiscoveryCategoryKind {
  /** Service providers (astrologers, halls, planners, …). */
  SERVICE = 'SERVICE',
  /** Product discovery (wedding shopping) — later release, separate data model. */
  PRODUCT = 'PRODUCT',
}

export enum ConsultationMode {
  IN_PERSON = 'IN_PERSON',
  PHONE = 'PHONE',
  VIDEO = 'VIDEO',
}

/** Same lifecycle as testimonials' ReviewStatus. */
export enum DiscoveryReviewStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  HIDDEN = 'HIDDEN',
}

export enum DiscoverySort {
  RECOMMENDED = 'recommended',
  NEAREST = 'nearest',
  RATING = 'rating',
  EXPERIENCE = 'experience',
  PRICE_ASC = 'price_asc',
  PRICE_DESC = 'price_desc',
}
