import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { createHash } from 'crypto';
import Redis from 'ioredis';

import { CustomLoggerService } from '../../logger/custom-logger.service';
import { ParsedIntentResult } from '../models/search-intent.model';

/**
 * Parsed-intent cache.
 *
 * Parsing is cheap, but the AI fallback is not — caching by query hash means a
 * given phrasing is only ever sent to the LLM once, and popular queries are
 * effectively free forever after.
 *
 * Redis is optional. `ioredis` is a dependency but no Redis server is configured
 * in this project today, so the service probes the connection at startup and
 * falls back to a bounded in-process map when it is unreachable. That keeps
 * local development and the current Cloud Run deployment working unchanged;
 * setting REDIS_HOST turns the shared cache on with no code change.
 */
@Injectable()
export class SearchCacheService implements OnModuleInit, OnModuleDestroy {
  private redis: Redis | null = null;
  private redisReady = false;

  /** TTL for a parsed intent: 30 days. Dictionaries change rarely. */
  private static readonly TTL_SECONDS = 30 * 24 * 60 * 60;

  /** Cap on the in-memory fallback so a long-running process cannot grow unbounded. */
  private static readonly MEMORY_MAX_ENTRIES = 1_000;

  private readonly memory = new Map<string, { value: string; expiresAt: number }>();

  constructor(private readonly logger: CustomLoggerService) {}

  async onModuleInit(): Promise<void> {
    const host = process.env.REDIS_HOST;
    if (!host) {
      this.logger.log('REDIS_HOST not set — search intent cache is using in-memory storage');
      return;
    }

    try {
      this.redis = new Redis({
        host,
        port: Number(process.env.REDIS_PORT ?? 6379),
        password: process.env.REDIS_PASSWORD || undefined,
        // Fail fast and stay quiet: the cache is an optimisation, and a Redis
        // outage must never take searching down or spam the logs with retries.
        maxRetriesPerRequest: 1,
        connectTimeout: 3_000,
        lazyConnect: true,
        retryStrategy: (times) => (times > 3 ? null : Math.min(times * 200, 1_000)),
      });

      this.redis.on('error', (err) => {
        if (this.redisReady) {
          this.redisReady = false;
          this.logger.warn(`Redis unavailable, falling back to in-memory cache: ${err.message}`);
        }
      });

      await this.redis.connect();
      this.redisReady = true;
      this.logger.log(`Search intent cache connected to Redis at ${host}`);
    } catch (error: any) {
      this.redisReady = false;
      this.redis = null;
      this.logger.warn(
        `Could not connect to Redis (${error?.message}) — using in-memory intent cache`,
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    try {
      await this.redis?.quit();
    } catch {
      // Shutting down; a failed quit is not actionable.
    }
  }

  /** `search_intent:{sha256(query)}` — stable across processes and restarts. */
  buildKey(query: string): string {
    const hash = createHash('sha256')
      .update(query.trim().toLowerCase().replace(/\s+/g, ' '))
      .digest('hex')
      .slice(0, 32);
    return `search_intent:${hash}`;
  }

  async getIntent(query: string): Promise<ParsedIntentResult | null> {
    const raw = await this.read(this.buildKey(query));
    if (!raw) return null;

    try {
      return JSON.parse(raw) as ParsedIntentResult;
    } catch {
      // Corrupt entry — treat as a miss rather than failing the search.
      return null;
    }
  }

  async setIntent(query: string, result: ParsedIntentResult): Promise<void> {
    await this.write(this.buildKey(query), JSON.stringify(result));
  }

  /**
   * Generic JSON cache, for values that are not parsed intents — currently the
   * facet catalogue behind typeahead suggestions, which is an expensive
   * aggregate over `profiles` that changes slowly.
   */
  async getJson<T>(key: string): Promise<T | null> {
    const raw = await this.read(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  async setJson(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    await this.write(key, JSON.stringify(value), ttlSeconds);
  }

  /** Clears one query's cached intent. Used when dictionaries are updated. */
  async invalidate(query: string): Promise<void> {
    const key = this.buildKey(query);
    this.memory.delete(key);
    if (this.redisReady && this.redis) {
      try {
        await this.redis.del(key);
      } catch {
        // Non-fatal.
      }
    }
  }

  // ─── Storage backends ──────────────────────────────────────────────────────

  private async read(key: string): Promise<string | null> {
    if (this.redisReady && this.redis) {
      try {
        return await this.redis.get(key);
      } catch {
        this.redisReady = false; // fall through to memory
      }
    }

    const entry = this.memory.get(key);
    if (!entry) return null;
    if (entry.expiresAt < Date.now()) {
      this.memory.delete(key);
      return null;
    }
    return entry.value;
  }

  private async write(key: string, value: string, ttlSeconds?: number): Promise<void> {
    const ttl = ttlSeconds ?? SearchCacheService.TTL_SECONDS;

    if (this.redisReady && this.redis) {
      try {
        await this.redis.set(key, value, 'EX', ttl);
        return;
      } catch {
        this.redisReady = false;
      }
    }

    // Simple FIFO eviction — good enough for a bounded optimisation cache.
    if (this.memory.size >= SearchCacheService.MEMORY_MAX_ENTRIES) {
      const oldest = this.memory.keys().next().value;
      if (oldest !== undefined) this.memory.delete(oldest);
    }
    this.memory.set(key, { value, expiresAt: Date.now() + ttl * 1_000 });
  }
}
