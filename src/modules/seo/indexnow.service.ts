import { Injectable, Logger } from '@nestjs/common';
import { siteUrl } from './seo-url.util';

/**
 * Tells IndexNow-enabled search engines (Bing, Yandex, Seznam, Naver…) that a public URL was
 * added, changed or removed. Disabled unless both SITE_URL and INDEXNOW_KEY are set.
 *
 * The key must also be served at {SITE_URL}/{INDEXNOW_KEY}.txt (see the web app's nginx config),
 * otherwise search engines ignore the notification.
 *
 * Only call this for public, indexable URLs (blog articles) and only when content actually
 * changed — never for member profiles.
 */
@Injectable()
export class IndexNowService {
  private readonly logger = new Logger(IndexNowService.name);
  private readonly key = (process.env.INDEXNOW_KEY ?? '').trim();
  private readonly endpoint = process.env.INDEXNOW_ENDPOINT || 'https://api.indexnow.org/indexnow';

  get enabled(): boolean {
    return !!siteUrl() && /^[a-zA-Z0-9-]{8,128}$/.test(this.key);
  }

  /** Fire-and-forget; failures are logged, never thrown into the caller's request. */
  notify(paths: string[]): void {
    const site = siteUrl();
    if (!this.enabled || !site || !paths.length) return;
    const host = new URL(site).host;
    const urlList = [...new Set(paths)].map(p => `${site}${p.startsWith('/') ? '' : '/'}${p}`);

    fetch(this.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ host, key: this.key, keyLocation: `${site}/${this.key}.txt`, urlList }),
      signal: AbortSignal.timeout(10_000),
    })
      .then(res => {
        if (res.status >= 400) this.logger.warn(`IndexNow responded ${res.status} for ${urlList.length} URL(s)`);
      })
      .catch(err => this.logger.warn(`IndexNow request failed: ${err instanceof Error ? err.message : err}`));
  }
}
