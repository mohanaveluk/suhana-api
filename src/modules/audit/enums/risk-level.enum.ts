// Risk severity buckets. Derived from a numeric risk score (0-100).
export enum RiskLevel {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

// Trust tiers derived from a numeric trust score (0-100).
export enum TrustTier {
  EXCELLENT = 'EXCELLENT', // 100
  TRUSTED = 'TRUSTED', // 80-99
  NORMAL = 'NORMAL', // 60-79
  WATCHLIST = 'WATCHLIST', // 40-59
  HIGH_RISK = 'HIGH_RISK', // 0-39
}

// Map a 0-100 risk score to a RiskLevel bucket.
export function riskScoreToLevel(score: number): RiskLevel {
  if (score >= 80) return RiskLevel.CRITICAL;
  if (score >= 60) return RiskLevel.HIGH;
  if (score >= 30) return RiskLevel.MEDIUM;
  return RiskLevel.LOW;
}

// Map a 0-100 trust score to a TrustTier bucket.
export function trustScoreToTier(score: number): TrustTier {
  if (score >= 100) return TrustTier.EXCELLENT;
  if (score >= 80) return TrustTier.TRUSTED;
  if (score >= 60) return TrustTier.NORMAL;
  if (score >= 40) return TrustTier.WATCHLIST;
  return TrustTier.HIGH_RISK;
}
