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

/** Who maintains a listing. Existing / admin-created listings are ADMIN_MANAGED. */
export enum ManagementType {
  ADMIN_MANAGED = 'ADMIN_MANAGED',
  PROVIDER_MANAGED = 'PROVIDER_MANAGED',
}

/**
 * Publication lifecycle. Admin-created listings are PUBLISHED immediately (unchanged behaviour);
 * provider-created ones start as DRAFT → SUBMITTED → PUBLISHED (or CHANGES_REQUESTED).
 * Only PUBLISHED listings are visible to members.
 */
export enum ListingStatus {
  DRAFT = 'DRAFT',
  SUBMITTED = 'SUBMITTED',
  CHANGES_REQUESTED = 'CHANGES_REQUESTED',
  PUBLISHED = 'PUBLISHED',
}

export enum ProviderMemberRole {
  OWNER = 'OWNER',
  STAFF = 'STAFF',
}

export enum ClaimStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
}

/** Account type on the shared `user` table. A MEMBER may also own listings. */
export enum AccountType {
  MEMBER = 'MEMBER',
  PROVIDER = 'PROVIDER',
}

export enum DiscoverySort {
  RECOMMENDED = 'recommended',
  NEAREST = 'nearest',
  RATING = 'rating',
  EXPERIENCE = 'experience',
  PRICE_ASC = 'price_asc',
  PRICE_DESC = 'price_desc',
}
