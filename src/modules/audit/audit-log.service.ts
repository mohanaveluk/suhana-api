import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThanOrEqual, Repository } from 'typeorm';
import { AuditLog } from './entity/audit-log.entity';
import { AuditEventPayload } from './audit.event';
import { AuditEventType } from './enums/audit-event-type.enum';
import { RiskLevel } from './enums/risk-level.enum';
import {
  RiskScoringEngine,
  EvaluatedFactor,
  RISK_FACTOR_RULES,
} from './risk-scoring.engine';
import { computeChangedFields, pickChanged } from './helpers/change-detection.util';
import { CustomLoggerService } from '../logger/custom-logger.service';
import {
  AdminAuditLogQueryDto,
  AuditLogItemDto,
  PaginatedAuditLogDto,
  ProfileUpdateTrustDto,
  QueryAuditLogDto,
  RedFlagQueryDto,
  RedFlagResultDto,
  RiskAnalysisDto,
  TimelineEntryDto,
  TopRedFlagsQueryDto,
} from './dto/audit-log.dto';

@Injectable()
export class AuditLogService {
  constructor(
    @InjectRepository(AuditLog)
    private readonly auditRepo: Repository<AuditLog>,
    private readonly riskEngine: RiskScoringEngine,
    private readonly logger: CustomLoggerService,
  ) {}

  // ── Write path ─────────────────────────────────────────────────────────
  // Persists one audit record. Derives changed_fields from old/new snapshots
  // (unless explicitly supplied) and stamps a per-event base risk. Never throws
  // into the caller — auditing must not break the originating action.
  async logEvent(payload: AuditEventPayload): Promise<AuditLog | null> {
    try {
      const changedFields =
        payload.changedFields ??
        (payload.oldValue || payload.newValue
          ? computeChangedFields(payload.oldValue, payload.newValue)
          : null);

      // Keep stored snapshots compact — only the fields that actually changed.
      const oldValue =
        changedFields && changedFields.length
          ? pickChanged(payload.oldValue, changedFields)
          : payload.oldValue ?? null;
      const newValue =
        changedFields && changedFields.length
          ? pickChanged(payload.newValue, changedFields)
          : payload.newValue ?? null;

      const { score, level } = this.riskEngine.baseRisk(payload.eventType);

      const entity = this.auditRepo.create({
        userId: payload.userId ?? null,
        profileId: payload.profileId ?? null,
        eventType: payload.eventType,
        entityType: payload.entityType ?? null,
        entityId: payload.entityId ?? null,
        oldValue,
        newValue,
        changedFields: changedFields && changedFields.length ? changedFields : null,
        description: payload.description ?? null,
        ipAddress: payload.ipAddress ?? null,
        userAgent: payload.userAgent ?? null,
        deviceType: payload.deviceType ?? null,
        platform: payload.platform ?? null,
        country: payload.country ?? null,
        state: payload.state ?? null,
        city: payload.city ?? null,
        riskScore: score,
        riskLevel: level,
      });

      return await this.auditRepo.save(entity);
    } catch (err) {
      this.logger.error(`Failed to persist audit log: ${(err as Error)?.message}`, (err as Error)?.stack);
      return null;
    }
  }

  // ── API 1: paginated user activity history ───────────────────────────────
  async getAuditLogs(userId: string, query: QueryAuditLogDto): Promise<PaginatedAuditLogDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const qb = this.auditRepo
      .createQueryBuilder('a')
      .where('a.user_id = :userId', { userId });

    if (query.eventType) qb.andWhere('a.event_type = :eventType', { eventType: query.eventType });
    this.applyDateRange(qb, query.startDate, query.endDate);

    const [rows, total] = await qb
      .orderBy('a.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return { total, page, limit, items: rows.map((r) => this.toItem(r)) };
  }

  // ── API 2: chronological timeline grouped by day ─────────────────────────
  async getTimeline(userId: string, query: QueryAuditLogDto): Promise<TimelineEntryDto[]> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 100;

    const qb = this.auditRepo
      .createQueryBuilder('a')
      .where('a.user_id = :userId', { userId });
    this.applyDateRange(qb, query.startDate, query.endDate);

    const rows = await qb
      .orderBy('a.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    const byDay = new Map<string, AuditLogItemDto[]>();
    for (const row of rows) {
      const day = row.createdAt.toISOString().slice(0, 10); // YYYY-MM-DD
      if (!byDay.has(day)) byDay.set(day, []);
      byDay.get(day)!.push(this.toItem(row));
    }

    return [...byDay.entries()].map(([date, events]) => ({ date, events }));
  }

  // ── API 3: activity summary counts ───────────────────────────────────────
  async getAuditSummary(userId: string): Promise<Record<string, number>> {
    const rows = await this.auditRepo
      .createQueryBuilder('a')
      .select('a.event_type', 'eventType')
      .addSelect('COUNT(*)', 'count')
      .where('a.user_id = :userId', { userId })
      .groupBy('a.event_type')
      .getRawMany<{ eventType: AuditEventType; count: string }>();

    const counts = new Map<string, number>();
    let totalEvents = 0;
    for (const r of rows) {
      const n = Number(r.count);
      counts.set(r.eventType, n);
      totalEvents += n;
    }
    const sum = (...events: AuditEventType[]) =>
      events.reduce((acc, e) => acc + (counts.get(e) ?? 0), 0);

    return {
      totalEvents,
      profileChanges: sum(
        AuditEventType.PROFILE_UPDATED,
        AuditEventType.PROFILE_NAME_CHANGED,
        AuditEventType.PROFILE_DOB_CHANGED,
        AuditEventType.PROFILE_LOCATION_CHANGED,
      ),
      photoChanges: sum(
        AuditEventType.PROFILE_PHOTO_ADDED,
        AuditEventType.PROFILE_PHOTO_UPDATED,
        AuditEventType.PROFILE_PHOTO_DELETED,
        AuditEventType.PROFILE_PHOTO_SET_PRIMARY,
        AuditEventType.GALLERY_PHOTO_ADDED,
        AuditEventType.GALLERY_PHOTO_UPDATED,
        AuditEventType.GALLERY_PHOTO_DELETED,
      ),
      interestsSent: sum(AuditEventType.INTEREST_SENT),
      interestsAccepted: sum(AuditEventType.INTEREST_ACCEPTED),
      shortlists: sum(AuditEventType.SHORTLISTED),
      profileViews: sum(AuditEventType.PROFILE_VIEWED),
      messagesSent: sum(AuditEventType.MESSAGE_SENT),
      logins: sum(AuditEventType.LOGIN_SUCCESS),
      loginFailures: sum(AuditEventType.LOGIN_FAILED),
    };
  }

  // ── API 4: generic red-flag detector ─────────────────────────────────────
  async detectRedFlag(userId: string, query: RedFlagQueryDto): Promise<RedFlagResultDto> {
    const windowDays = query.days ?? (query.weeks ? query.weeks * 7 : 30);
    const since = this.daysAgo(windowDays);

    const count = await this.auditRepo.count({
      where: {
        userId,
        eventType: query.eventType,
        createdAt: MoreThanOrEqual(since),
      },
    });

    const redFlagDetected = count >= query.threshold;
    // Severity scales with how far the count overshoots the threshold.
    const ratio = query.threshold > 0 ? count / query.threshold : 0;
    let riskLevel = RiskLevel.LOW;
    if (redFlagDetected) {
      riskLevel = ratio >= 3 ? RiskLevel.CRITICAL : ratio >= 2 ? RiskLevel.HIGH : RiskLevel.MEDIUM;
    }

    return {
      redFlagDetected,
      count,
      threshold: query.threshold,
      riskLevel,
      recommendation: redFlagDetected
        ? `${this.humanize(query.eventType)} occurred ${count} times in ${windowDays} days — exceeds the threshold of ${query.threshold}.`
        : `No red flag: ${this.humanize(query.eventType)} occurred ${count} times in ${windowDays} days (threshold ${query.threshold}).`,
    };
  }

  // ── API 5: advanced multi-factor risk analysis ───────────────────────────
  async getUserRiskAnalysis(userId: string): Promise<RiskAnalysisDto> {
    const factors = await this.evaluateFactorsForUser(userId);
    const result = this.riskEngine.aggregate(factors);
    return {
      overallRiskScore: result.overallRiskScore,
      riskLevel: result.riskLevel,
      trustScore: result.trustScore,
      trustTier: result.trustTier,
      factors: result.factors.map((f) => ({
        event: f.event,
        count: f.count,
        score: f.score,
        reason: f.reason,
      })),
    };
  }

  // ── API 6: admin audit search (cross-user, filterable) ────────────────────
  async adminSearch(query: AdminAuditLogQueryDto): Promise<PaginatedAuditLogDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const qb = this.auditRepo.createQueryBuilder('a');
    if (query.userId) qb.andWhere('a.user_id = :userId', { userId: query.userId });
    if (query.eventType) qb.andWhere('a.event_type = :eventType', { eventType: query.eventType });
    if (query.entityType) qb.andWhere('a.entity_type = :entityType', { entityType: query.entityType });
    if (query.riskLevel) qb.andWhere('a.risk_level = :riskLevel', { riskLevel: query.riskLevel });
    this.applyDateRange(qb, query.startDate, query.endDate);

    const [rows, total] = await qb
      .orderBy('a.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return { total, page, limit, items: rows.map((r) => this.toItem(r)) };
  }

  // ── API 7: top red-flag users ordered by risk ────────────────────────────
  async getTopRedFlagUsers(query: TopRedFlagsQueryDto): Promise<RiskAnalysisDto[]> {
    const limit = query.limit ?? 100;
    const capDays = query.days ?? 90;

    // Accumulate triggered factors per user. One grouped query per rule keeps
    // this bounded (≈ number of rules) rather than one query per user.
    const perUser = new Map<string, EvaluatedFactor[]>();

    for (const rule of RISK_FACTOR_RULES) {
      const windowDays = Math.min(rule.windowDays, capDays);
      const since = this.daysAgo(windowDays);

      const rows = await this.auditRepo
        .createQueryBuilder('a')
        .select('a.user_id', 'userId')
        .addSelect('COUNT(*)', 'count')
        .where('a.user_id IS NOT NULL')
        .andWhere('a.event_type IN (:...events)', { events: rule.events })
        .andWhere('a.created_at >= :since', { since })
        .groupBy('a.user_id')
        .having('COUNT(*) >= :threshold', { threshold: rule.threshold })
        .getRawMany<{ userId: string; count: string }>();

      for (const row of rows) {
        const factor = this.riskEngine.scoreFactor(rule, Number(row.count));
        if (!factor) continue;
        if (!perUser.has(row.userId)) perUser.set(row.userId, []);
        perUser.get(row.userId)!.push(factor);
      }
    }

    const results = [...perUser.entries()].map(([userId, factors]) => {
      const agg = this.riskEngine.aggregate(factors);
      return {
        userId,
        overallRiskScore: agg.overallRiskScore,
        riskLevel: agg.riskLevel,
        trustScore: agg.trustScore,
        trustTier: agg.trustTier,
        factors: agg.factors.map((f) => ({ event: f.event, count: f.count, score: f.score, reason: f.reason })),
      } as RiskAnalysisDto & { userId: string };
    });

    return results
      .sort((a, b) => b.overallRiskScore - a.overallRiskScore)
      .slice(0, limit);
  }

  async getProfileIndicatorByUserId(
    userId: string, profileId: string
  ): Promise<ProfileUpdateTrustDto> {
    const count = await this.auditRepo
      .createQueryBuilder('audit')
      .where('audit.profileId = :profileId', { profileId })
      .andWhere('audit.eventType = :eventType', {
        eventType: 'PROFILE_UPDATED',
      })
      .andWhere(
        'audit.createdAt >= DATE_SUB(NOW(), INTERVAL 14 DAY)',
      )
      .getCount();

    let trustIndicator:
      | 'GREEN_FLAG'
      | 'YELLOW_FLAG'
      | 'RED_FLAG';

    if (count > 5) {
      trustIndicator = 'RED_FLAG';
    } else if (count >= 3) {
      trustIndicator = 'YELLOW_FLAG';
    } else {
      trustIndicator = 'GREEN_FLAG';
    }

    return {
      userId,
      updateCount: count,
      trustIndicator,
    };
  }  

  // ── Internals ─────────────────────────────────────────────────────────────
  private async evaluateFactorsForUser(userId: string): Promise<EvaluatedFactor[]> {
    const factors: EvaluatedFactor[] = [];
    for (const rule of RISK_FACTOR_RULES) {
      const since = this.daysAgo(rule.windowDays);
      const count = await this.auditRepo
        .createQueryBuilder('a')
        .where('a.user_id = :userId', { userId })
        .andWhere('a.event_type IN (:...events)', { events: rule.events })
        .andWhere('a.created_at >= :since', { since })
        .getCount();
      const factor = this.riskEngine.scoreFactor(rule, count);
      if (factor) factors.push(factor);
    }
    return factors;
  }

  private applyDateRange(qb: any, startDate?: string, endDate?: string): void {
    if (startDate && endDate) {
      qb.andWhere('a.created_at BETWEEN :startDate AND :endDate', {
        startDate: new Date(startDate),
        endDate: new Date(endDate),
      });
    } else if (startDate) {
      qb.andWhere('a.created_at >= :startDate', { startDate: new Date(startDate) });
    } else if (endDate) {
      qb.andWhere('a.created_at <= :endDate', { endDate: new Date(endDate) });
    }
  }

  private daysAgo(days: number): Date {
    return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  }

  private humanize(eventType: string): string {
    return eventType.toLowerCase().replace(/_/g, ' ');
  }

  private toItem(a: AuditLog): AuditLogItemDto {
    return {
      id: a.id,
      userId: a.userId,
      profileId: a.profileId,
      eventType: a.eventType,
      entityType: a.entityType,
      entityId: a.entityId,
      changedFields: a.changedFields,
      description: a.description,
      ipAddress: a.ipAddress,
      deviceType: a.deviceType,
      platform: a.platform,
      riskScore: a.riskScore,
      riskLevel: a.riskLevel,
      createdAt: a.createdAt,
    };
  }
}
