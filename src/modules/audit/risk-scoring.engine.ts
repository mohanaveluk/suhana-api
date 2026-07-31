import { Injectable } from '@nestjs/common';
import { AuditEventType } from './enums/audit-event-type.enum';
import {
  RiskLevel,
  TrustTier,
  riskScoreToLevel,
  trustScoreToTier,
} from './enums/risk-level.enum';

// A behavioural risk rule: "if the user did <events> at least <threshold> times
// in the last <windowDays> days, contribute risk". Score scales with how far
// the count exceeds the threshold, capped at maxScore.
export interface RiskFactorRule {
  key: string;
  label: string;
  events: AuditEventType[];
  windowDays: number;
  threshold: number;
  // Score contributed when count === threshold; grows by `step` per extra
  // occurrence, capped at `maxScore`.
  weightAtThreshold: number;
  step: number;
  maxScore: number;
  reason: string;
}

export interface EvaluatedFactor {
  event: AuditEventType; // representative event for the rule
  key: string;
  label: string;
  count: number;
  threshold: number;
  score: number;
  reason: string;
}

export interface RiskAnalysisResult {
  overallRiskScore: number;
  riskLevel: RiskLevel;
  trustScore: number;
  trustTier: TrustTier;
  factors: EvaluatedFactor[];
}

// Per-event base risk contribution written on each audit row (0-100). Aggregate
// behaviour matters more than any single event, so most events are low; a few
// security-relevant ones carry weight on their own.
const BASE_RISK: Partial<Record<AuditEventType, number>> = {
  [AuditEventType.LOGIN_FAILED]: 15,
  [AuditEventType.PAYMENT_FAILED]: 15,
  [AuditEventType.PROFILE_REPORTED]: 40,
  [AuditEventType.PROFILE_BLOCKED]: 25,
  [AuditEventType.ACCOUNT_DEACTIVATED]: 20,
  [AuditEventType.MATCH_FIXED_CANCELLED]: 15,
  [AuditEventType.PROFILE_GENDER_CHANGED]: 30,
  [AuditEventType.PROFILE_DOB_CHANGED]: 25,
  [AuditEventType.PROFILE_NAME_CHANGED]: 15,
  [AuditEventType.PROFILE_RELIGION_CHANGED]: 15,
  [AuditEventType.PROFILE_CASTE_CHANGED]: 15,
  [AuditEventType.PASSWORD_CHANGED]: 10,
  [AuditEventType.EMAIL_CHANGED]: 10,
  [AuditEventType.MOBILE_CHANGED]: 10,
};

// The behavioural rule set powering the risk-analysis endpoint (API 5) and the
// trust score. Mirrors the "Analyze" list plus the matrimony-specific red flags.
export const RISK_FACTOR_RULES: RiskFactorRule[] = [
  // ── Identity risk ────────────────────────────────────────────────────────
  { key: 'name_changes', label: 'Frequent name changes', events: [AuditEventType.PROFILE_NAME_CHANGED], windowDays: 30, threshold: 3, weightAtThreshold: 15, step: 5, maxScore: 30, reason: 'Profile name changed repeatedly in a short period.' },
  { key: 'dob_changes', label: 'Date-of-birth changes', events: [AuditEventType.PROFILE_DOB_CHANGED], windowDays: 30, threshold: 2, weightAtThreshold: 20, step: 10, maxScore: 40, reason: 'Date of birth changed multiple times.' },
  { key: 'gender_changes', label: 'Gender changes', events: [AuditEventType.PROFILE_GENDER_CHANGED], windowDays: 90, threshold: 1, weightAtThreshold: 25, step: 15, maxScore: 40, reason: 'Gender changed — verify identity.' },
  { key: 'religion_caste_changes', label: 'Religion/caste changes', events: [AuditEventType.PROFILE_RELIGION_CHANGED, AuditEventType.PROFILE_CASTE_CHANGED], windowDays: 30, threshold: 2, weightAtThreshold: 12, step: 6, maxScore: 30, reason: 'Religion/caste changed repeatedly.' },
  { key: 'edu_occupation_changes', label: 'Education/occupation churn', events: [AuditEventType.PROFILE_EDUCATION_CHANGED, AuditEventType.PROFILE_OCCUPATION_CHANGED], windowDays: 30, threshold: 3, weightAtThreshold: 10, step: 4, maxScore: 24, reason: 'Education/occupation changed repeatedly.' },

  // ── Profile / location risk ───────────────────────────────────────────────
  { key: 'profile_churn', label: 'Excessive profile edits', events: [AuditEventType.PROFILE_UPDATED], windowDays: 14, threshold: 5, weightAtThreshold: 15, step: 3, maxScore: 30, reason: 'Profile modified excessively in a short period.' },
  { key: 'location_changes', label: 'Frequent location changes', events: [AuditEventType.PROFILE_LOCATION_CHANGED], windowDays: 30, threshold: 3, weightAtThreshold: 15, step: 6, maxScore: 30, reason: 'Location changed frequently.' },

  // ── Photo risk ────────────────────────────────────────────────────────────
  { key: 'photo_churn', label: 'Frequent photo changes', events: [AuditEventType.PROFILE_PHOTO_UPDATED, AuditEventType.PROFILE_PHOTO_ADDED, AuditEventType.PROFILE_PHOTO_DELETED], windowDays: 7, threshold: 10, weightAtThreshold: 15, step: 2, maxScore: 30, reason: 'Photos changed excessively.' },
  { key: 'primary_photo_churn', label: 'Primary photo churn', events: [AuditEventType.PROFILE_PHOTO_SET_PRIMARY], windowDays: 30, threshold: 10, weightAtThreshold: 15, step: 3, maxScore: 30, reason: 'Primary photo changed excessively.' },

  // ── Matchmaking risk ──────────────────────────────────────────────────────
  { key: 'interest_spam', label: 'Interest blasting', events: [AuditEventType.INTEREST_SENT], windowDays: 1, threshold: 100, weightAtThreshold: 25, step: 1, maxScore: 40, reason: 'Sent an unusually high number of interests in 24 hours.' },
  { key: 'shortlist_spam', label: 'Shortlist blasting', events: [AuditEventType.SHORTLISTED], windowDays: 7, threshold: 500, weightAtThreshold: 20, step: 1, maxScore: 30, reason: 'Shortlisted an unusually high number of profiles in a week.' },
  { key: 'view_spam', label: 'Profile-view scraping', events: [AuditEventType.PROFILE_VIEWED], windowDays: 1, threshold: 1000, weightAtThreshold: 20, step: 1, maxScore: 35, reason: 'Viewed an unusually high number of profiles in a day.' },
  { key: 'match_cancellations', label: 'Repeated match cancellations', events: [AuditEventType.MATCH_FIXED_CANCELLED], windowDays: 30, threshold: 3, weightAtThreshold: 12, step: 5, maxScore: 30, reason: 'Repeatedly cancelled fixed matches.' },

  // ── Communication risk ────────────────────────────────────────────────────
  { key: 'message_spam', label: 'Message blasting', events: [AuditEventType.MESSAGE_SENT], windowDays: 1, threshold: 200, weightAtThreshold: 20, step: 1, maxScore: 35, reason: 'Sent a very high volume of messages in 24 hours.' },

  // ── Financial risk ────────────────────────────────────────────────────────
  { key: 'plan_churn', label: 'Membership churn', events: [AuditEventType.PLAN_UPGRADED, AuditEventType.PLAN_DOWNGRADED], windowDays: 30, threshold: 4, weightAtThreshold: 10, step: 3, maxScore: 24, reason: 'Frequent membership upgrades/downgrades.' },
  { key: 'payment_failures', label: 'Repeated payment failures', events: [AuditEventType.PAYMENT_FAILED], windowDays: 30, threshold: 3, weightAtThreshold: 12, step: 4, maxScore: 28, reason: 'Repeated payment failures.' },

  // ── Account / security risk ───────────────────────────────────────────────
  { key: 'login_failures', label: 'Multiple login failures', events: [AuditEventType.LOGIN_FAILED], windowDays: 1, threshold: 5, weightAtThreshold: 15, step: 3, maxScore: 30, reason: 'Multiple failed login attempts.' },
  { key: 'deactivation_cycling', label: 'Deactivation/reactivation cycling', events: [AuditEventType.ACCOUNT_DEACTIVATED, AuditEventType.ACCOUNT_REACTIVATED], windowDays: 30, threshold: 3, weightAtThreshold: 15, step: 6, maxScore: 30, reason: 'Account repeatedly deactivated and reactivated.' },
  { key: 'reported', label: 'Reported by other members', events: [AuditEventType.PROFILE_REPORTED], windowDays: 90, threshold: 1, weightAtThreshold: 30, step: 15, maxScore: 50, reason: 'Reported by one or more members.' },
];

@Injectable()
export class RiskScoringEngine {
  // Per-row base risk written on each audit event.
  baseRisk(eventType: AuditEventType): { score: number; level: RiskLevel } {
    const score = BASE_RISK[eventType] ?? 0;
    return { score, level: riskScoreToLevel(score) };
  }

  // Score a single behavioural factor given how many matching events occurred.
  // Returns null when the count is below the rule's threshold (not a factor).
  scoreFactor(rule: RiskFactorRule, count: number): EvaluatedFactor | null {
    if (count < rule.threshold) return null;
    const raw = rule.weightAtThreshold + (count - rule.threshold) * rule.step;
    const score = Math.min(rule.maxScore, Math.round(raw));
    return {
      event: rule.events[0],
      key: rule.key,
      label: rule.label,
      count,
      threshold: rule.threshold,
      score,
      reason: rule.reason,
    };
  }

  // Combine triggered factors into an overall risk score (capped at 100),
  // a risk level, and the inverse trust score/tier.
  aggregate(factors: EvaluatedFactor[]): RiskAnalysisResult {
    const overallRiskScore = Math.min(
      100,
      factors.reduce((sum, f) => sum + f.score, 0),
    );
    const trustScore = Math.max(0, 100 - overallRiskScore);
    return {
      overallRiskScore,
      riskLevel: riskScoreToLevel(overallRiskScore),
      trustScore,
      trustTier: trustScoreToTier(trustScore),
      factors: factors.sort((a, b) => b.score - a.score),
    };
  }
}
