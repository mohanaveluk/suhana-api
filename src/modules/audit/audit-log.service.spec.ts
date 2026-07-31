import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AuditLogService } from './audit-log.service';
import { AuditLog } from './entity/audit-log.entity';
import { RiskScoringEngine } from './risk-scoring.engine';
import { CustomLoggerService } from '../logger/custom-logger.service';
import { AuditEventType } from './enums/audit-event-type.enum';
import { RiskLevel } from './enums/risk-level.enum';

describe('AuditLogService', () => {
  let service: AuditLogService;
  let repo: any;

  const makeQb = (overrides: Partial<Record<string, any>> = {}) => {
    const qb: any = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      having: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      getMany: jest.fn().mockResolvedValue([]),
      getRawMany: jest.fn().mockResolvedValue([]),
      getCount: jest.fn().mockResolvedValue(0),
      ...overrides,
    };
    return qb;
  };

  beforeEach(async () => {
    repo = {
      create: jest.fn((x) => x),
      save: jest.fn((x) => Promise.resolve({ id: 'generated-id', ...x })),
      count: jest.fn().mockResolvedValue(0),
      createQueryBuilder: jest.fn(() => makeQb()),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditLogService,
        RiskScoringEngine,
        { provide: getRepositoryToken(AuditLog), useValue: repo },
        { provide: CustomLoggerService, useValue: { error: jest.fn(), log: jest.fn(), debug: jest.fn() } },
      ],
    }).compile();

    service = module.get(AuditLogService);
  });

  describe('logEvent', () => {
    it('derives changed_fields from old/new snapshots and stamps base risk', async () => {
      await service.logEvent({
        eventType: AuditEventType.PROFILE_UPDATED,
        userId: 'u1',
        oldValue: { age: 27, city: 'Dallas' },
        newValue: { age: 29, city: 'Houston' },
      });

      expect(repo.save).toHaveBeenCalledTimes(1);
      const saved = repo.create.mock.calls[0][0];
      expect(saved.changedFields.sort()).toEqual(['age', 'city']);
      // only changed keys retained in snapshots
      expect(saved.oldValue).toEqual({ age: 27, city: 'Dallas' });
      expect(saved.riskLevel).toBe(RiskLevel.LOW);
    });

    it('stamps a higher base risk for reported profiles', async () => {
      await service.logEvent({ eventType: AuditEventType.PROFILE_REPORTED, userId: 'u1' });
      const saved = repo.create.mock.calls[0][0];
      expect(saved.riskScore).toBe(40);
      expect(saved.riskLevel).toBe(RiskLevel.MEDIUM);
    });

    it('never throws — returns null on repository failure', async () => {
      repo.save.mockRejectedValueOnce(new Error('db down'));
      const result = await service.logEvent({ eventType: AuditEventType.LOGIN_SUCCESS, userId: 'u1' });
      expect(result).toBeNull();
    });
  });

  describe('detectRedFlag', () => {
    it('trips the flag and escalates severity with overshoot', async () => {
      repo.count.mockResolvedValueOnce(7);
      const result = await service.detectRedFlag('u1', {
        eventType: AuditEventType.PROFILE_UPDATED,
        days: 14,
        threshold: 5,
      });
      expect(result.redFlagDetected).toBe(true);
      expect(result.count).toBe(7);
      expect(result.riskLevel).toBe(RiskLevel.MEDIUM); // ratio 1.4 → MEDIUM
    });

    it('marks CRITICAL when count is 3x+ the threshold', async () => {
      repo.count.mockResolvedValueOnce(20);
      const result = await service.detectRedFlag('u1', {
        eventType: AuditEventType.INTEREST_SENT,
        days: 1,
        threshold: 5,
      });
      expect(result.riskLevel).toBe(RiskLevel.CRITICAL);
    });

    it('does not flag below threshold', async () => {
      repo.count.mockResolvedValueOnce(2);
      const result = await service.detectRedFlag('u1', {
        eventType: AuditEventType.PROFILE_UPDATED,
        weeks: 2,
        threshold: 5,
      });
      expect(result.redFlagDetected).toBe(false);
      expect(result.riskLevel).toBe(RiskLevel.LOW);
    });
  });

  describe('getUserRiskAnalysis', () => {
    it('aggregates triggered factors into an overall score + trust', async () => {
      // Every factor query returns a high count so rules trip.
      repo.createQueryBuilder.mockImplementation(() =>
        makeQb({ getCount: jest.fn().mockResolvedValue(1000) }),
      );
      const result = await service.getUserRiskAnalysis('u1');
      expect(result.overallRiskScore).toBeGreaterThan(0);
      expect(result.factors.length).toBeGreaterThan(0);
      expect(result.trustScore).toBe(100 - result.overallRiskScore);
    });

    it('returns zero risk / full trust for an inactive user', async () => {
      const result = await service.getUserRiskAnalysis('u1'); // all counts default 0
      expect(result.overallRiskScore).toBe(0);
      expect(result.trustScore).toBe(100);
      expect(result.factors).toEqual([]);
    });
  });

  describe('getAuditLogs', () => {
    it('returns paginated shape', async () => {
      const result = await service.getAuditLogs('u1', { page: 2, limit: 10 });
      expect(result).toEqual({ total: 0, page: 2, limit: 10, items: [] });
    });
  });
});
