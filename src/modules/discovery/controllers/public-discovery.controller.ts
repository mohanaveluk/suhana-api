import { Controller, Get, Param, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { DiscoverySearchQueryDto, ProviderSearchQueryDto, ProviderSearchResponseDto } from '../dto/discovery-search.dto';
import { CategoryDto, DiscoveryReviewListDto, ProviderDetailDto, ReviewListQueryDto } from '../dto/discovery-detail.dto';
import { DiscoveryCatalogService } from '../services/discovery-catalog.service';
import { DiscoverySearchService } from '../services/discovery-search.service';
import { DiscoveryReviewsService } from '../services/discovery-reviews.service';
import { MemberThrottlerGuard } from './member-throttler.guard';

class PublicDetailQueryDto extends DiscoverySearchQueryDto {
  @ApiPropertyOptional({ description: 'Category the visitor came from.' })
  @IsOptional() @IsString() @MaxLength(64)
  category?: string;
}

/**
 * Read-only, sign-in-free Discover browsing — used by the Aurora for Providers
 * website (aurora-providers-web) so businesses and prospective providers can
 * see how listings appear. Businesses only: no member data is exposed.
 *
 * Deliberately NOT public: contact reveal, favorites and posting reviews stay
 * on the member endpoints (`discovery/*`, JWT). Same visibility rules as
 * member search (only PUBLISHED, active, non-rejected/suspended listings).
 * Throttled per IP.
 */
@ApiTags('Aurora Discover — Public (read-only)')
@Controller('public/discovery')
export class PublicDiscoveryController {
  constructor(
    private readonly catalog: DiscoveryCatalogService,
    private readonly search: DiscoverySearchService,
    private readonly reviews: DiscoveryReviewsService,
  ) {}

  @Get('categories')
  @ApiOperation({ summary: 'All Discover categories (inactive = coming soon)' })
  @ApiResponse({ status: 200, type: [CategoryDto] })
  categories(): Promise<CategoryDto[]> {
    return this.catalog.listCategories();
  }

  @Get('providers')
  @UseGuards(MemberThrottlerGuard)
  @Throttle({ default: { limit: 40, ttl: 60_000 } })
  @ApiOperation({ summary: 'Search published listings in an active category (no contact details)' })
  @ApiResponse({ status: 200, type: ProviderSearchResponseDto })
  providers(@Query() q: ProviderSearchQueryDto): Promise<ProviderSearchResponseDto> {
    return this.search.search(q.category, q, '');
  }

  @Get('providers/:id')
  @UseGuards(MemberThrottlerGuard)
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiOperation({ summary: 'Public listing detail (contact channels are flags only)' })
  @ApiResponse({ status: 200, type: ProviderDetailDto })
  provider(@Param('id', new ParseUUIDPipe()) id: string, @Query() q: PublicDetailQueryDto): Promise<ProviderDetailDto> {
    return this.search.getProvider(id, '', {
      categorySlug: q.category || undefined, unit: q.unit, postalCode: q.postalCode, country: q.country,
    });
  }

  @Get('providers/:id/reviews')
  @ApiOperation({ summary: 'Approved reviews of a listing' })
  @ApiResponse({ status: 200, type: DiscoveryReviewListDto })
  providerReviews(@Param('id', new ParseUUIDPipe()) id: string, @Query() q: ReviewListQueryDto): Promise<DiscoveryReviewListDto> {
    return this.reviews.list(id, '', q.page ?? 1, q.limit ?? 10);
  }
}
