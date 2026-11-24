import {
  Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Query, Request, UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth, ApiOperation, ApiParam, ApiPropertyOptional, ApiQuery, ApiResponse, ApiTags,
} from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { CATEGORY_SLUGS } from '../constants/discovery.constants';
import {
  AstrologerSearchQueryDto, DiscoverySearchQueryDto, ProviderSearchQueryDto, ProviderSearchResponseDto,
} from '../dto/discovery-search.dto';
import {
  CategoryDto, CreateDiscoveryReviewDto, DiscoveryReviewDto, DiscoveryReviewListDto, FavoritesQueryDto,
  ProviderContactDto, ProviderDetailDto, ReviewListQueryDto,
} from '../dto/discovery-detail.dto';
import { DiscoveryCatalogService } from '../services/discovery-catalog.service';
import { DiscoverySearchService } from '../services/discovery-search.service';
import { DiscoveryFavoritesService } from '../services/discovery-favorites.service';
import { DiscoveryReviewsService } from '../services/discovery-reviews.service';
import { MemberThrottlerGuard } from './member-throttler.guard';

/** Detail-page query: optional origin + unit so distances match the list the member came from. */
class DetailQueryDto extends DiscoverySearchQueryDto {
  @ApiPropertyOptional({ description: 'Category the member came from (details are shown for that category).' })
  @IsOptional() @IsString() @MaxLength(64)
  category?: string;
}

const SEARCH_LIMIT = { default: { limit: 60, ttl: 60_000 } };
const CONTACT_LIMIT = { default: { limit: 15, ttl: 60_000 } };
const REVIEW_LIMIT = { default: { limit: 5, ttl: 60_000 } };

/**
 * Aurora Discover — member endpoints. All require a signed-in member.
 * Nothing here reads or stores the member's own location beyond the request
 * (device coordinates are coarsened to ~1 km and never persisted).
 */
@ApiTags('Aurora Discover')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('discovery')
export class DiscoveryController {
  constructor(
    private readonly catalog: DiscoveryCatalogService,
    private readonly search: DiscoverySearchService,
    private readonly favorites: DiscoveryFavoritesService,
    private readonly reviews: DiscoveryReviewsService,
  ) {}

  // ── Categories ──────────────────────────────────────────────────────────

  @Get('categories')
  @ApiOperation({ summary: 'All Discover categories (inactive ones are "coming soon")' })
  @ApiResponse({ status: 200, type: [CategoryDto] })
  listCategories(): Promise<CategoryDto[]> {
    return this.catalog.listCategories();
  }

  @Get('categories/:slug')
  @ApiOperation({ summary: 'One category by slug' })
  @ApiResponse({ status: 200, type: CategoryDto })
  @ApiResponse({ status: 404, description: 'Unknown category' })
  getCategory(@Param('slug') slug: string): Promise<CategoryDto> {
    return this.catalog.getCategory(slug);
  }

  // ── Astrologers (Phase 1) ───────────────────────────────────────────────

  @Get('astrologers')
  @UseGuards(MemberThrottlerGuard)
  @Throttle(SEARCH_LIMIT)
  @ApiOperation({
    summary: 'Find an astrologer near you',
    description:
      'Location: device lat/lng (after an explicit click), US ZIP / India PIN, city (+state) + country, state + country, ' +
      'or country only. Radius 5/10/25/50/100/all in mi or km (default by country). Sorting is transparent — the ' +
      'response explains the applied order and, for "recommended", its factor weights.',
  })
  @ApiResponse({ status: 200, type: ProviderSearchResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid or unknown ZIP/PIN code, unsupported country, bad filter' })
  @ApiResponse({ status: 429, description: 'Too many searches' })
  searchAstrologers(@Request() req: any, @Query() q: AstrologerSearchQueryDto): Promise<ProviderSearchResponseDto> {
    return this.search.search(CATEGORY_SLUGS.ASTROLOGER, q, req.user.id);
  }

  @Get('astrologers/:id')
  @ApiOperation({ summary: 'Astrologer profile' })
  @ApiParam({ name: 'id', description: 'Provider id' })
  @ApiResponse({ status: 200, type: ProviderDetailDto })
  @ApiResponse({ status: 404, description: 'Not found, not an astrologer, or not visible' })
  getAstrologer(
    @Request() req: any,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query() q: DetailQueryDto,
  ): Promise<ProviderDetailDto> {
    return this.search.getProvider(id, req.user.id, { categorySlug: CATEGORY_SLUGS.ASTROLOGER, ...this.originOf(q) });
  }

  // ── Generic engine (future categories) ──────────────────────────────────

  @Get('providers')
  @UseGuards(MemberThrottlerGuard)
  @Throttle(SEARCH_LIMIT)
  @ApiOperation({ summary: 'Search any active category (same filters; category-specific ones apply where supported)' })
  @ApiResponse({ status: 200, type: ProviderSearchResponseDto })
  @ApiResponse({ status: 404, description: 'Unknown category, or category coming soon' })
  searchProviders(@Request() req: any, @Query() q: ProviderSearchQueryDto): Promise<ProviderSearchResponseDto> {
    return this.search.search(q.category, q, req.user.id);
  }

  @Get('providers/:id')
  @ApiOperation({ summary: 'Any provider profile' })
  @ApiResponse({ status: 200, type: ProviderDetailDto })
  getProvider(
    @Request() req: any,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query() q: DetailQueryDto,
  ): Promise<ProviderDetailDto> {
    return this.search.getProvider(id, req.user.id, { ...this.originOf(q), categorySlug: q.category || undefined });
  }

  @Post('providers/:id/contact')
  @HttpCode(HttpStatus.OK)
  @UseGuards(MemberThrottlerGuard)
  @Throttle(CONTACT_LIMIT)
  @ApiOperation({
    summary: "Reveal a listing's contact details",
    description: 'Contact details are released per listing on request (rate-limited) rather than in search results, to deter scraping.',
  })
  @ApiResponse({ status: 200, type: ProviderContactDto })
  @ApiResponse({ status: 429, description: 'Too many requests' })
  getContact(@Param('id', new ParseUUIDPipe()) id: string): Promise<ProviderContactDto> {
    return this.search.getContact(id);
  }

  // ── Reviews ─────────────────────────────────────────────────────────────

  @Get('providers/:id/reviews')
  @ApiOperation({ summary: 'Approved reviews for a listing (+ the caller’s own review in any status)' })
  @ApiResponse({ status: 200, type: DiscoveryReviewListDto })
  listReviews(
    @Request() req: any,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query() q: ReviewListQueryDto,
  ): Promise<DiscoveryReviewListDto> {
    return this.reviews.list(id, req.user.id, q.page ?? 1, q.limit ?? 10);
  }

  @Post('providers/:id/reviews')
  @UseGuards(MemberThrottlerGuard)
  @Throttle(REVIEW_LIMIT)
  @ApiOperation({ summary: 'Submit a review (one per member per listing; published after moderation)' })
  @ApiResponse({ status: 201, type: DiscoveryReviewDto })
  @ApiResponse({ status: 409, description: 'Already reviewed' })
  createReview(
    @Request() req: any,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: CreateDiscoveryReviewDto,
  ): Promise<DiscoveryReviewDto> {
    return this.reviews.create(id, req.user.id, dto);
  }

  // ── Favorites ───────────────────────────────────────────────────────────

  @Get('favorites')
  @ApiOperation({ summary: "The caller's saved listings" })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  listFavorites(@Request() req: any, @Query() q: FavoritesQueryDto) {
    return this.favorites.list(req.user.id, q.page ?? 1, q.limit ?? 20);
  }

  @Post('favorites/:providerId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Save a listing (idempotent)' })
  addFavorite(@Request() req: any, @Param('providerId', new ParseUUIDPipe()) providerId: string) {
    return this.favorites.add(req.user.id, providerId);
  }

  @Delete('favorites/:providerId')
  @ApiOperation({ summary: 'Remove a saved listing (idempotent; only ever affects the caller)' })
  removeFavorite(@Request() req: any, @Param('providerId', new ParseUUIDPipe()) providerId: string) {
    return this.favorites.remove(req.user.id, providerId);
  }

  private originOf(q: DetailQueryDto) {
    return { unit: q.unit, lat: q.lat, lng: q.lng, postalCode: q.postalCode, country: q.country };
  }
}
