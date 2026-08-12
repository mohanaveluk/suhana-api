import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { SearchHistory } from '../entities/search-history.entity';
import { SearchIntent } from '../models/search-intent.model';
import { IntentSource } from '../enums/search.enums';
import {
  PopularSearchItemDto, RecentSearchItemDto,
} from '../dto/ai-search.dto';
import { CustomLoggerService } from '../../logger/custom-logger.service';

export interface RecordSearchInput {
  userId?: string | null;
  query: string;
  intent: SearchIntent;
  confidence: number;
  intentSource: IntentSource;
  resultCount: number;
  searchTimeMs: number;
  ipAddress?: string | null;
}

@Injectable()
export class SearchAnalyticsService {
  constructor(
    @InjectRepository(SearchHistory)
    private readonly historyRepo: Repository<SearchHistory>,
    private readonly logger: CustomLoggerService,
  ) {}

  /**
   * Records one executed search. Fire-and-forget by contract: analytics must
   * never fail or slow a search, so all errors are swallowed and logged.
   */
  async record(input: RecordSearchInput): Promise<void> {
    try {
      await this.historyRepo.save(
        this.historyRepo.create({
          userId: input.userId ?? null,
          query: input.query.slice(0, 500),
          normalisedQuery: this.normalise(input.query),
          parsedIntent: input.intent,
          confidence: input.confidence,
          intentSource: input.intentSource,
          resultCount: input.resultCount,
          searchTimeMs: input.searchTimeMs,
          ipAddress: input.ipAddress ?? null,
        }),
      );
    } catch (error: any) {
      this.logger.error(`Failed to record search history: ${error?.message}`, error?.stack);
    }
  }

  /**
   * Most-run queries in a rolling window.
   *
   * Grouped on normalisedQuery so casing and spacing variants aggregate.
   * `averageResults` is included deliberately: a popular query with near-zero
   * average results is the highest-value signal in this whole system — many
   * people want something the catalogue or the parser cannot serve.
   */
  async getPopularSearches(limit = 10, windowDays = 30): Promise<PopularSearchItemDto[]> {
    const since = this.daysAgo(windowDays);

    const rows = await this.historyRepo
      .createQueryBuilder('s')
      .select('s.normalised_query', 'query')
      .addSelect('COUNT(*)', 'searchCount')
      .addSelect('AVG(s.result_count)', 'averageResults')
      .where('s.created_at >= :since', { since })
      .andWhere('s.normalised_query != :empty', { empty: '' })
      .groupBy('s.normalised_query')
      .orderBy('searchCount', 'DESC')
      .limit(limit)
      .getRawMany<{ query: string; searchCount: string; averageResults: string }>();

    return rows.map((r) => ({
      query: r.query,
      searchCount: Number(r.searchCount),
      averageResults: Math.round(Number(r.averageResults) || 0),
    }));
  }

  /** A member's own recent searches, de-duplicated, newest first. */
  async getRecentSearches(userId: string, limit = 10): Promise<RecentSearchItemDto[]> {
    // Over-fetch, then de-duplicate in code: MySQL cannot express
    // "latest row per normalised_query" without a window function or a
    // self-join, and this list is short by definition.
    const rows = await this.historyRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: limit * 4,
    });

    const seen = new Set<string>();
    const results: RecentSearchItemDto[] = [];

    for (const row of rows) {
      if (seen.has(row.normalisedQuery)) continue;
      seen.add(row.normalisedQuery);
      results.push({
        query: row.query,
        resultCount: row.resultCount,
        confidence: row.confidence,
        createdAt: row.createdAt,
      });
      if (results.length >= limit) break;
    }

    return results;
  }

  /**
   * Searches that returned nothing — the parser-tuning worklist.
   * Each entry is either a dictionary gap or a genuine catalogue gap.
   */
  async getFailedSearches(limit = 20, windowDays = 30): Promise<PopularSearchItemDto[]> {
    const since = this.daysAgo(windowDays);

    const rows = await this.historyRepo
      .createQueryBuilder('s')
      .select('s.normalised_query', 'query')
      .addSelect('COUNT(*)', 'searchCount')
      .where('s.created_at >= :since', { since })
      .andWhere('s.result_count = 0')
      .groupBy('s.normalised_query')
      .orderBy('searchCount', 'DESC')
      .limit(limit)
      .getRawMany<{ query: string; searchCount: string }>();

    return rows.map((r) => ({
      query: r.query,
      searchCount: Number(r.searchCount),
      averageResults: 0,
    }));
  }

  /**
   * Most-requested values per facet, read out of the stored intents.
   *
   * Uses MySQL JSON extraction rather than loading rows into memory, so this
   * stays cheap as history grows.
   */
  async getFacetTrends(
    facet: 'profession' | 'state' | 'city' | 'religion',
    limit = 10,
    windowDays = 30,
  ): Promise<Array<{ value: string; count: number }>> {
    const since = this.daysAgo(windowDays);

    const rows = await this.historyRepo
      .createQueryBuilder('s')
      .select(`JSON_UNQUOTE(JSON_EXTRACT(s.parsed_intent, '$.${facet}'))`, 'value')
      .addSelect('COUNT(*)', 'count')
      .where('s.created_at >= :since', { since })
      .andWhere(`JSON_EXTRACT(s.parsed_intent, '$.${facet}') IS NOT NULL`)
      .groupBy('value')
      .orderBy('count', 'DESC')
      .limit(limit)
      .getRawMany<{ value: string; count: string }>();

    return rows
      .filter((r) => r.value && r.value !== 'null')
      .map((r) => ({ value: r.value, count: Number(r.count) }));
  }

  /**
   * Popular personality traits. Traits are a JSON array, so unlike the scalar
   * facets they have to be counted in code.
   */
  async getPopularTraits(limit = 10, windowDays = 30): Promise<Array<{ value: string; count: number }>> {
    const since = this.daysAgo(windowDays);

    const rows = await this.historyRepo
      .createQueryBuilder('s')
      .select('s.parsed_intent', 'parsedIntent')
      .where('s.created_at >= :since', { since })
      .andWhere(`JSON_EXTRACT(s.parsed_intent, '$.personalityTraits') IS NOT NULL`)
      .limit(5_000) // bounded scan — this is a dashboard figure, not a ledger
      .getRawMany<{ parsedIntent: string | Record<string, any> }>();

    const counts = new Map<string, number>();
    for (const row of rows) {
      const intent =
        typeof row.parsedIntent === 'string'
          ? this.safeParse(row.parsedIntent)
          : row.parsedIntent;

      for (const trait of intent?.personalityTraits ?? []) {
        counts.set(trait, (counts.get(trait) ?? 0) + 1);
      }
    }

    return [...counts.entries()]
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  /**
   * How often the LLM fallback is being paid for. A rising ratio means the
   * dictionaries are drifting behind how members actually phrase things.
   */
  async getFallbackRate(windowDays = 7): Promise<{ total: number; fallback: number; ratio: number }> {
    const since = this.daysAgo(windowDays);

    const [total, fallback] = await Promise.all([
      this.historyRepo.createQueryBuilder('s')
        .where('s.created_at >= :since', { since }).getCount(),
      this.historyRepo.createQueryBuilder('s')
        .where('s.created_at >= :since', { since })
        .andWhere('s.intent_source = :source', { source: IntentSource.AI_FALLBACK })
        .getCount(),
    ]);

    return {
      total,
      fallback,
      ratio: total ? Math.round((fallback / total) * 1000) / 10 : 0,
    };
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  /** Grouping key: lower-cased, punctuation-free, whitespace-collapsed. */
  private normalise(query: string): string {
    return (query ?? '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 500);
  }

  private daysAgo(days: number): Date {
    return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  }

  private safeParse(value: string): Record<string, any> | null {
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  }
}
