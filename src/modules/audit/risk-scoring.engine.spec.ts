import { RiskScoringEngine, RISK_FACTOR_RULES } from './risk-scoring.engine';
import { AuditEventType } from './enums/audit-event-type.enum';
import { RiskLevel, TrustTier } from './enums/risk-level.enum';

describe('RiskScoringEngine', () => {
  let engine: RiskScoringEngine;

  beforeEach(() => {
    engine = new RiskScoringEngine();
  });

  describe('baseRisk', () => {
    it('assigns a base score to security-relevant events', () => {
      expect(engine.baseRisk(AuditEventType.PROFILE_REPORTED).score).toBe(40);
      expect(engine.baseRisk(AuditEventType.PROFILE_REPORTED).level).toBe(RiskLevel.MEDIUM);
    });

    it('assigns zero risk / LOW to benign events', () => {
      const r = engine.baseRisk(AuditEventType.PROFILE_VIEWED);
      expect(r.score).toBe(0);
      expect(r.level).toBe(RiskLevel.LOW);
    });
  });

  describe('scoreFactor', () => {
    const rule = RISK_FACTOR_RULES.find((r) => r.key === 'profile_churn')!;

    it('returns null below threshold', () => {
      expect(engine.scoreFactor(rule, rule.threshold - 1)).toBeNull();
    });

    it('returns weightAtThreshold exactly at threshold', () => {
      const f = engine.scoreFactor(rule, rule.threshold)!;
      expect(f.score).toBe(rule.weightAtThreshold);
      expect(f.count).toBe(rule.threshold);
    });

    it('scales with overshoot but caps at maxScore', () => {
      const f = engine.scoreFactor(rule, rule.threshold + 1000)!;
      expect(f.score).toBe(rule.maxScore);
    });
  });

  describe('aggregate', () => {
    it('sums factor scores, caps at 100, and derives inverse trust', () => {
      const factors = [
        { event: AuditEventType.PROFILE_UPDATED, key: 'a', label: 'a', count: 10, threshold: 5, score: 30, reason: 'x' },
        { event: AuditEventType.PROFILE_PHOTO_UPDATED, key: 'b', label: 'b', count: 20, threshold: 10, score: 30, reason: 'y' },
      ];
      const result = engine.aggregate(factors);
      expect(result.overallRiskScore).toBe(60);
      expect(result.riskLevel).toBe(RiskLevel.HIGH);
      expect(result.trustScore).toBe(40);
      expect(result.trustTier).toBe(TrustTier.WATCHLIST);
    });

    it('caps overall risk at 100 and floors trust at 0', () => {
      const factors = Array.from({ length: 5 }, (_, i) => ({
        event: AuditEventType.PROFILE_UPDATED, key: `k${i}`, label: 'l', count: 99, threshold: 1, score: 30, reason: 'r',
      }));
      const result = engine.aggregate(factors);
      expect(result.overallRiskScore).toBe(100);
      expect(result.riskLevel).toBe(RiskLevel.CRITICAL);
      expect(result.trustScore).toBe(0);
      expect(result.trustTier).toBe(TrustTier.HIGH_RISK);
    });

    it('gives a perfect trust score with no factors', () => {
      const result = engine.aggregate([]);
      expect(result.overallRiskScore).toBe(0);
      expect(result.trustScore).toBe(100);
      expect(result.trustTier).toBe(TrustTier.EXCELLENT);
    });

    it('sorts factors by descending score', () => {
      const factors = [
        { event: AuditEventType.PROFILE_UPDATED, key: 'a', label: 'a', count: 1, threshold: 1, score: 10, reason: 'x' },
        { event: AuditEventType.PROFILE_REPORTED, key: 'b', label: 'b', count: 1, threshold: 1, score: 50, reason: 'y' },
      ];
      const result = engine.aggregate(factors);
      expect(result.factors[0].score).toBe(50);
    });
  });
});
