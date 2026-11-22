import { Controller, Get, Header, ServiceUnavailableException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Repository } from 'typeorm';
import { BlogPost } from '../blog/entities/blog-post.entity';
import { blogPostPath, siteUrl } from './seo-url.util';

const xmlEscape = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

/**
 * Public, unauthenticated SEO endpoints. Only public content is ever listed here —
 * never member profiles, search results or anything user-specific.
 */
@ApiTags('seo')
@Controller('seo')
export class SeoController {
  constructor(@InjectRepository(BlogPost) private readonly posts: Repository<BlogPost>) {}

  // GET /seo/sitemap-blog.xml — served on the website as /sitemap-blog.xml (nginx proxy)
  @Get('sitemap-blog.xml')
  @Header('Content-Type', 'application/xml; charset=utf-8')
  @Header('Cache-Control', 'public, max-age=3600')
  @ApiOperation({ summary: 'Sitemap of published blog articles (lastmod = last content update)' })
  @ApiResponse({ status: 200, description: 'XML sitemap' })
  async blogSitemap(): Promise<string> {
    const site = siteUrl();
    if (!site) throw new ServiceUnavailableException('SITE_URL is not configured');

    const rows = await this.posts.find({
      where: { published: true },
      select: ['id', 'title', 'updated_at', 'published_at'],
      order: { published_at: 'DESC' },
      take: 50_000, // sitemap protocol limit per file
    });

    const urls = rows.map(p => {
      const lastmod = (p.updated_at ?? p.published_at)?.toISOString?.();
      return `  <url>\n    <loc>${xmlEscape(site + blogPostPath(p.id, p.title))}</loc>\n` +
        (lastmod ? `    <lastmod>${lastmod}</lastmod>\n` : '') + `  </url>`;
    });

    return `<?xml version="1.0" encoding="UTF-8"?>\n` +
      `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`;
  }
}
