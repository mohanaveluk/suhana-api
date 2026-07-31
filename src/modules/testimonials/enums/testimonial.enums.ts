// ── Reviews ────────────────────────────────────────────────────────────────
export enum ReviewType {
  GENERAL = 'GENERAL',
  MATCHMAKING = 'MATCHMAKING',
  MEMBERSHIP = 'MEMBERSHIP',
  CUSTOMER_SUPPORT = 'CUSTOMER_SUPPORT',
  SUCCESS_STORY = 'SUCCESS_STORY',
}

export enum ReviewStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  HIDDEN = 'HIDDEN',
}

export enum ReviewSentiment {
  POSITIVE = 'POSITIVE',
  NEUTRAL = 'NEUTRAL',
  NEGATIVE = 'NEGATIVE',
}

// ── Replies ──────────────────────────────────────────────────────────────
export enum ReplyStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

// ── Reports ────────────────────────────────────────────────────────────────
export enum ReportReason {
  SPAM = 'SPAM',
  ABUSE = 'ABUSE',
  FAKE_REVIEW = 'FAKE_REVIEW',
  OFFENSIVE_LANGUAGE = 'OFFENSIVE_LANGUAGE',
  OTHER = 'OTHER',
}

export enum ReportStatus {
  OPEN = 'OPEN',
  UNDER_REVIEW = 'UNDER_REVIEW',
  RESOLVED = 'RESOLVED',
  DISMISSED = 'DISMISSED',
}

// ── Success stories ──────────────────────────────────────────────────────
export enum SuccessStoryStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

// Verified Marriage Badge lifecycle.
export enum MarriageVerificationStatus {
  PENDING = 'PENDING',
  VERIFIED = 'VERIFIED',
  REJECTED = 'REJECTED',
}

// ── Public listing sort options ───────────────────────────────────────────
export enum ReviewSort {
  LATEST = 'latest',
  OLDEST = 'oldest',
  MOST_LIKED = 'mostLiked',
  HIGHEST_RATED = 'highestRated',
}
