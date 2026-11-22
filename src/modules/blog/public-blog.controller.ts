import { Controller, Get, Header, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { NestBlogService } from './blog.service';

const CATEGORIES = new Set(['guide', 'vote', 'party', 'suhana', 'tips', 'news']);

/**
 * Read-only, unauthenticated access to *published* blog articles for the public website
 * (blog pages, prerendering, sharing). Everything else about the blog — writing, comments,
 * likes, Q&A — stays on the authenticated BlogController.
 */
@ApiTags('blog (public)')
@Controller('public/blog')
export class PublicBlogController {
  constructor(private readonly blogSvc: NestBlogService) {}

  // GET /public/blog/posts
  @Get('posts')
  @Header('Cache-Control', 'public, max-age=300')
  @ApiOperation({ summary: 'List published blog articles (newest first)' })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'pageSize', required: false, example: 12 })
  @ApiQuery({ name: 'category', required: false })
  getPosts(
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '12',
    @Query('category') category?: string,
  ) {
    const p = Math.max(1, Math.floor(Number(page)) || 1);
    const size = Math.min(50, Math.max(1, Math.floor(Number(pageSize)) || 12));
    return this.blogSvc.getPosts({
      page: p,
      pageSize: size,
      category: category && CATEGORIES.has(category) ? category : undefined,
      sort: 'newest',
    });
  }

  // GET /public/blog/posts/:id
  @Get('posts/:id')
  @Header('Cache-Control', 'public, max-age=300')
  @ApiOperation({ summary: 'Get one published blog article' })
  @ApiParam({ name: 'id', description: 'UUID of the article' })
  @ApiResponse({ status: 404, description: 'Not found or not published' })
  getPost(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.blogSvc.getPost(id);
  }
}
