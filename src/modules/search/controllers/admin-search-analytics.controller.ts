import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags,
} from '@nestjs/swagger';

import { SearchAnalyticsService } from '../services/search-analytics.service';
import { PopularSearchItemDto } from '../dto/ai-search.dto';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';

@ApiTags('[Admin] Search Analytics')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('admin/search-analytics')
export class AdminSearchAnalyticsController {
  constructor(private readonly analytics: SearchAnalyticsService) {}

  // GET /api/v1/admin/search-analytics/failed-searches
  @Get('failed-searches')
  @ApiOperation({
    summary: '[Admin] Searches that returned no results',
    description:
      'The parser-tuning worklist. Every entry is either a dictionary gap — members ' +
      'phrasing something the parser does not recognise — or a genuine catalogue gap. ' +
      'Closing the first kind by extending a dictionary removes an LLM cost permanently.',
  })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiQuery({ name: 'days', required: false, example: 30 })
  @ApiResponse({ status: 200, description: 'Zero-result searches', type: [PopularSearchItemDto] })
  @ApiResponse({ status: 403, description: 'Forbidden — admin role required' })
  getFailedSearches(
    @Query('limit') limit?: string,
    @Query('days') days?: string,
  ): Promise<PopularSearchItemDto[]> {
    return this.analytics.getFailedSearches(
      this.clamp(limit, 20, 1, 100),
      this.clamp(days, 30, 1, 365),
    );
  }

  // GET /api/v1/admin/search-analytics/trends
  @Get('trends')
  @ApiOperation({
    summary: '[Admin] Most-requested values per facet',
    description:
      'Top professions, locations or religions members are searching for, read out of the ' +
      'stored intents. Useful for acquisition targeting — demand the catalogue is not meeting.',
  })
  @ApiQuery({
    name: 'facet', required: false,
    enum: ['profession', 'state', 'city', 'religion'],
    description: 'Which facet to aggregate. Default: profession',
  })
  @ApiQuery({ name: 'limit', required: false, example: 10 })
  @ApiQuery({ name: 'days', required: false, example: 30 })
  @ApiResponse({ status: 200, description: 'Facet value counts' })
  @ApiResponse({ status: 403, description: 'Forbidden — admin role required' })
  getTrends(
    @Query('facet') facet?: string,
    @Query('limit') limit?: string,
    @Query('days') days?: string,
  ): Promise<Array<{ value: string; count: number }>> {
    const allowed = ['profession', 'state', 'city', 'religion'] as const;
    const selected = allowed.includes(facet as any)
      ? (facet as (typeof allowed)[number])
      : 'profession';

    return this.analytics.getFacetTrends(
      selected,
      this.clamp(limit, 10, 1, 50),
      this.clamp(days, 30, 1, 365),
    );
  }

  // GET /api/v1/admin/search-analytics/popular-traits
  @Get('popular-traits')
  @ApiOperation({
    summary: '[Admin] Most-requested personality traits',
    description:
      'What members actually say they are looking for, aggregated from parsed intents. ' +
      'Traits are stored as a JSON array, so this is counted in code over a bounded scan.',
  })
  @ApiQuery({ name: 'limit', required: false, example: 10 })
  @ApiQuery({ name: 'days', required: false, example: 30 })
  @ApiResponse({ status: 200, description: 'Trait counts' })
  @ApiResponse({ status: 403, description: 'Forbidden — admin role required' })
  getPopularTraits(
    @Query('limit') limit?: string,
    @Query('days') days?: string,
  ): Promise<Array<{ value: string; count: number }>> {
    return this.analytics.getPopularTraits(
      this.clamp(limit, 10, 1, 50),
      this.clamp(days, 30, 1, 365),
    );
  }

  // GET /api/v1/admin/search-analytics/fallback-rate
  @Get('fallback-rate')
  @ApiOperation({
    summary: '[Admin] How often the AI fallback is being paid for',
    description:
      'Share of searches in the window that required an LLM call. This is the cost dial ' +
      'for the whole feature — a rising ratio means the local dictionaries are drifting ' +
      'behind how members phrase things, and extending them is far cheaper than the inference.',
  })
  @ApiQuery({ name: 'days', required: false, example: 7 })
  @ApiResponse({
    status: 200,
    description: 'Fallback usage',
    schema: { example: { total: 4820, fallback: 143, ratio: 3.0 } },
  })
  @ApiResponse({ status: 403, description: 'Forbidden — admin role required' })
  getFallbackRate(
    @Query('days') days?: string,
  ): Promise<{ total: number; fallback: number; ratio: number }> {
    return this.analytics.getFallbackRate(this.clamp(days, 7, 1, 365));
  }

  private clamp(raw: string | undefined, fallback: number, min: number, max: number): number {
    const value = Number(raw);
    if (!Number.isFinite(value)) return fallback;
    return Math.min(max, Math.max(min, Math.trunc(value)));
  }
}
