import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CustomLoggerService } from 'src/modules/logger/custom-logger.service';
import { AppSetting } from './entity/app-setting.entity';
import { APP_SETTING_DEFAULTS, AppSettingKey } from './app-settings.keys';

/** How long a value is served from memory. Changes on other instances apply within this window. */
export const APP_SETTINGS_CACHE_MS = 30_000;

interface CacheEntry { value: string; at: number }

/**
 * Reads/writes `app_settings`. Reads are cached per instance for APP_SETTINGS_CACHE_MS so hot
 * paths (every SMS) don't hit the DB. If the DB is unreachable the last known value is used,
 * falling back to the key's default.
 */
@Injectable()
export class AppSettingsService {
  private readonly cache = new Map<string, CacheEntry>();

  constructor(
    @InjectRepository(AppSetting) private readonly repo: Repository<AppSetting>,
    private readonly logger: CustomLoggerService,
    private readonly now: () => number = Date.now,
  ) {}

  async get(key: AppSettingKey): Promise<string> {
    const hit = this.cache.get(key);
    if (hit && this.now() - hit.at < APP_SETTINGS_CACHE_MS) return hit.value;
    try {
      const row = await this.repo.findOne({ where: { key } });
      const value = row?.value ?? APP_SETTING_DEFAULTS[key];
      this.cache.set(key, { value, at: this.now() });
      return value;
    } catch (e: any) {
      this.logger.warn(`app_settings read failed for '${key}': ${e?.message} — using ${hit ? 'last known' : 'default'} value`);
      return hit?.value ?? APP_SETTING_DEFAULTS[key];
    }
  }

  async getBoolean(key: AppSettingKey): Promise<boolean> {
    return (await this.get(key)).trim().toLowerCase() === 'true';
  }

  /** Full row (value + who/when), uncached — for admin screens. */
  async getRecord(key: AppSettingKey): Promise<{ value: string; updatedBy: string | null; updatedAt: Date | null }> {
    const row = await this.repo.findOne({ where: { key } });
    return { value: row?.value ?? APP_SETTING_DEFAULTS[key], updatedBy: row?.updatedBy ?? null, updatedAt: row?.updatedAt ?? null };
  }

  /** Upserts the value and refreshes this instance's cache immediately. Returns the previous value. */
  async set(key: AppSettingKey, value: string, updatedBy: string | null): Promise<string> {
    const previous = (await this.getRecord(key)).value;
    await this.repo.save(this.repo.create({ key, value, updatedBy }));
    this.cache.set(key, { value, at: this.now() });
    return previous;
  }
}
