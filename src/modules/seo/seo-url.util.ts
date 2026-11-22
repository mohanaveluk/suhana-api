/**
 * Public site URLs used by the sitemap and IndexNow. Must stay in sync with the web app's
 * blog routes (/matrimony-blog/:id/:slug) and its `blogSlug()` helper.
 */
export function siteUrl(): string | null {
  const url = (process.env.SITE_URL ?? '').trim().replace(/\/+$/, '');
  return /^https?:\/\//i.test(url) ? url : null;
}

export function blogSlug(title: string): string {
  return (title ?? '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/g, '') || 'article';
}

export function blogPostPath(id: string, title: string): string {
  return `/matrimony-blog/${encodeURIComponent(id)}/${blogSlug(title)}`;
}
