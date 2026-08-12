import {
  Body, Controller, Delete, Get, Param, Post, Query, Request, UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags,
} from '@nestjs/swagger';

import { AiSearchService } from '../services/ai-search.service';
import { SearchAnalyticsService } from '../services/search-analytics.service';
import { SavedSearchService } from '../services/saved-search.service';
import { SearchSuggestionService } from '../services/search-suggestion.service';
import {
  AiSearchRequestDto, AiSearchResponseDto, PopularSearchItemDto,
  RecentSearchItemDto, SaveSearchDto, SavedSearchItemDto,
  SearchSuggestionsResponseDto,
} from '../dto/ai-search.dto';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { Public } from 'src/common/decorators/public.decorator';

@ApiTags('AI Search')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('search')
export class AiSearchController {
  constructor(
    private readonly aiSearchService: AiSearchService,
    private readonly analytics: SearchAnalyticsService,
    private readonly savedSearches: SavedSearchService,
    private readonly suggestions: SearchSuggestionService,
  ) {}

  // POST /api/v1/search/ai
  @Post('ai')
  @ApiOperation({
    summary: 'Natural-language profile search',
    description:
      'Converts a free-text query into structured filters and returns ranked profiles.\n\n' +
      '**How the intent is resolved (cheapest path first):**\n' +
      '1. **Cache** — a previously parsed intent for this query (30-day TTL).\n' +
      '2. **Local NLP parser** — dictionary + fuzzy matching, in-process, no network.\n' +
      '3. **AI fallback** — an LLM is consulted *only* when local confidence is below 80, ' +
      'and its output is merged into the local parse rather than replacing it.\n\n' +
      'The `intentSource` field on the response reports which path ran, so the cost profile ' +
      'is observable per request.\n\n' +
      '**Spelling is corrected automatically** — "Docotr in Texass" resolves to ' +
      'profession `Doctor`, state `Texas`, and the corrections are echoed back in `corrections` ' +
      'so the UI can show "showing results for...".\n\n' +
      '**Understood query styles include:**\n' +
      '- `Find me a caring, family-oriented doctor in Texas`\n' +
      '- `Show Tamil speaking software engineers willing to relocate`\n' +
      '- `Find a bride who values family more than career`\n' +
      '- `Show highly educated Hindu matches in California`\n' +
      '- `Find profiles similar to Nandhini`\n' +
      '- `Find verified premium members in Texas`\n' +
      '- `Show profiles active in the last 30 days`\n' +
      '- `Find highly compatible profiles with 85%+ match score`\n' +
      '- `Find matches my parents would approve`\n' +
      '- `Show matches similar to my shortlisted profiles`',
  })
  @ApiBody({ type: AiSearchRequestDto })
  @ApiResponse({
    status: 201,
    description: 'Ranked search results with the extracted intent',
    type: AiSearchResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Empty query, or page/limit out of range' })
  @ApiResponse({ status: 401, description: 'Unauthorized — missing or invalid JWT' })
  search(
    @Request() req: any,
    @Body() dto: AiSearchRequestDto,
  ): Promise<AiSearchResponseDto> {
    return this.aiSearchService.search(dto, this.context(req));
  }

  // GET /api/v1/search/ai/suggestions
  @Public()
  @Get('ai/suggestions')
  @ApiOperation({
    summary: 'Typeahead search suggestions',
    description:
      'Live suggestions for the search box, generated from whatever the member has typed so far.\n\n' +
      '**With input** — the partial query is parsed to see which facets it already covers, ' +
      'and suggestions propose the ones it is missing:\n\n' +
      '```\n' +
      'q = "Hindu bride"\n' +
      '  → Hindu bride from Texas\n' +
      '  → Hindu bride with a Master\'s degree\n' +
      '  → Hindu bride working as a Doctor\n' +
      '  → Hindu bride aged 25-30\n' +
      '```\n\n' +
      'A half-typed final word is completed first, so `q = "Hindu bri"` returns ' +
      '`Hindu bride` before proposing refinements.\n\n' +
      '**With no input** — returns queries other members actually run (skipping any that ' +
      'historically return nothing), topped up with curated examples.\n\n' +
      '**Cost and latency:** entirely local. No LLM call, and the profile aggregate behind ' +
      'the suggested values is cached for an hour — safe to call on every keystroke. ' +
      'Values are drawn from live profiles, so it never suggests a filter that would ' +
      'return an empty result set.\n\n' +
      'Public: the search box renders before sign-in.',
  })
  @ApiQuery({
    name: 'q',
    required: false,
    example: 'Hindu bride',
    description: 'What the member has typed so far. Omit for the empty-state list.',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    example: 8,
    description: 'Maximum suggestions to return (1-20, default 8)',
  })
  @ApiResponse({
    status: 200,
    description: 'Ranked suggestions',
    type: SearchSuggestionsResponseDto,
  })
  async getSuggestions(
    @Query('q') q?: string,
    @Query('limit') limit?: string,
  ): Promise<SearchSuggestionsResponseDto> {
    const query = (q ?? '').trim();
    return {
      success: true,
      query,
      data: await this.suggestions.suggest(query, this.clamp(limit, 8, 1, 20)),
    };
  }

  // GET /api/v1/search/similar/:profileId
  @Get('similar/:profileId')
  @ApiOperation({
    summary: 'Find profiles similar to a given profile',
    description:
      'Derives an intent from the reference profile — profession, education, religion, ' +
      'location, mother tongue, family type, age band and horoscope — then runs it through ' +
      'the same ranking pipeline as a text search.\n\n' +
      'Searches the **opposite** gender: a similar profile in matrimony means a comparable ' +
      'match, not another candidate of the same gender. The reference profile is never ' +
      'returned in its own results.',
  })
  @ApiParam({ name: 'profileId', description: 'Reference profile UUID' })
  @ApiQuery({
    name: 'limit', required: false, example: 20,
    description: 'Maximum profiles to return (1-100, default 20)',
  })
  @ApiResponse({ status: 200, description: 'Ranked similar profiles', type: AiSearchResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized — missing or invalid JWT' })
  @ApiResponse({ status: 404, description: 'Reference profile not found' })
  findSimilar(
    @Request() req: any,
    @Param('profileId') profileId: string,
    @Query('limit') limit?: string,
  ): Promise<AiSearchResponseDto> {
    const parsed = Number(limit);
    const take = Number.isFinite(parsed) ? Math.min(100, Math.max(1, parsed)) : 20;
    return this.aiSearchService.findSimilar(profileId, take, this.context(req));
  }

  // GET /api/v1/search/popular-searches
  @Get('popular-searches')
  @ApiOperation({
    summary: 'Most-run searches across the platform',
    description:
      'Aggregated over a rolling window, grouped on the normalised query so casing and ' +
      'spacing variants count as one.\n\n' +
      '`averageResults` is included on purpose: a popular query with a near-zero average ' +
      'is the single most valuable signal here — many members want something the ' +
      'catalogue or the parser cannot currently serve.',
  })
  @ApiQuery({ name: 'limit', required: false, example: 10, description: 'Default 10, max 50' })
  @ApiQuery({ name: 'days', required: false, example: 30, description: 'Window in days, default 30' })
  @ApiResponse({ status: 200, description: 'Popular searches', type: [PopularSearchItemDto] })
  @ApiResponse({ status: 401, description: 'Unauthorized — missing or invalid JWT' })
  getPopularSearches(
    @Query('limit') limit?: string,
    @Query('days') days?: string,
  ): Promise<PopularSearchItemDto[]> {
    return this.analytics.getPopularSearches(
      this.clamp(limit, 10, 1, 50),
      this.clamp(days, 30, 1, 365),
    );
  }

  // GET /api/v1/search/recent-searches
  @Get('recent-searches')
  @ApiOperation({
    summary: 'My recent searches',
    description:
      'The authenticated member\'s own search history, de-duplicated and newest first, ' +
      'for re-running a previous search in one tap.',
  })
  @ApiQuery({ name: 'limit', required: false, example: 10, description: 'Default 10, max 50' })
  @ApiResponse({ status: 200, description: 'Recent searches', type: [RecentSearchItemDto] })
  @ApiResponse({ status: 401, description: 'Unauthorized — missing or invalid JWT' })
  getRecentSearches(
    @Request() req: any,
    @Query('limit') limit?: string,
  ): Promise<RecentSearchItemDto[]> {
    return this.analytics.getRecentSearches(req.user.id, this.clamp(limit, 10, 1, 50));
  }

  // POST /api/v1/search/save-search
  @Post('save-search')
  @ApiOperation({
    summary: 'Save a search for later',
    description:
      'Stores the query together with its parsed intent, so replaying it costs no ' +
      'parsing and — for a query that originally needed the AI fallback — no repeat ' +
      'inference.\n\n' +
      'Saving the same query twice updates the existing entry rather than duplicating it. ' +
      'Up to 50 saved searches per member.',
  })
  @ApiBody({ type: SaveSearchDto })
  @ApiResponse({ status: 201, description: 'Search saved', type: SavedSearchItemDto })
  @ApiResponse({ status: 400, description: 'Empty query, or the 50-search limit was reached' })
  @ApiResponse({ status: 401, description: 'Unauthorized — missing or invalid JWT' })
  async saveSearch(
    @Request() req: any,
    @Body() dto: SaveSearchDto,
  ): Promise<SavedSearchItemDto> {
    // Run the search first so the saved entry carries a real intent and a
    // meaningful baseline result count.
    const result = await this.aiSearchService.search(
      { query: dto.query, page: 1, limit: 1 },
      this.context(req),
    );

    return this.savedSearches.save(
      req.user.id, dto.query, dto.name, result.searchIntent, result.totalResults,
    );
  }

  // GET /api/v1/search/saved-searches
  @Get('saved-searches')
  @ApiOperation({
    summary: 'My saved searches',
    description:
      'Newest first. Each entry carries the intent captured at save time and the result ' +
      'count then, so the UI can highlight how many new profiles have appeared since.',
  })
  @ApiResponse({ status: 200, description: 'Saved searches', type: [SavedSearchItemDto] })
  @ApiResponse({ status: 401, description: 'Unauthorized — missing or invalid JWT' })
  getSavedSearches(@Request() req: any): Promise<SavedSearchItemDto[]> {
    return this.savedSearches.list(req.user.id);
  }

  // DELETE /api/v1/search/saved-searches/:id
  @Delete('saved-searches/:id')
  @ApiOperation({
    summary: 'Delete a saved search',
    description: 'Soft-deletes the saved search. Search history is unaffected.',
  })
  @ApiParam({ name: 'id', description: 'Saved search UUID' })
  @ApiResponse({ status: 200, description: 'Saved search deleted' })
  @ApiResponse({ status: 401, description: 'Unauthorized — missing or invalid JWT' })
  @ApiResponse({ status: 404, description: 'Saved search not found or not yours' })
  deleteSavedSearch(
    @Request() req: any,
    @Param('id') id: string,
  ): Promise<{ success: boolean; message: string }> {
    return this.savedSearches.remove(id, req.user.id);
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  private context(req: any) {
    const forwarded = req.headers?.['x-forwarded-for'];
    const ipAddress =
      (typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : undefined) ||
      req.ip ||
      req.socket?.remoteAddress;

    return { userId: req.user?.id ?? null, ipAddress };
  }

  private clamp(raw: string | undefined, fallback: number, min: number, max: number): number {
    const value = Number(raw);
    if (!Number.isFinite(value)) return fallback;
    return Math.min(max, Math.max(min, Math.trunc(value)));
  }
}
