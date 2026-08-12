import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';

import { Match, Profile, User } from '../user/entity';
import { SearchHistory } from './entities/search-history.entity';
import { SavedSearch } from './entities/saved-search.entity';

import { AiSearchController } from './controllers/ai-search.controller';
import { AdminSearchAnalyticsController } from './controllers/admin-search-analytics.controller';

import { AiSearchService } from './services/ai-search.service';
import { SearchQueryBuilderService } from './services/search-query-builder.service';
import { SearchAnalyticsService } from './services/search-analytics.service';
import { SavedSearchService } from './services/saved-search.service';
import { SearchSuggestionService } from './services/search-suggestion.service';
import { SearchIntentParserService } from './parsers/search-intent-parser.service';
import { FuzzyMatchService } from './parsers/fuzzy-match.service';
import { SynonymService } from './parsers/synonym.service';
import { MatchRankingService } from './ranking/match-ranking.service';
import { SearchCacheService } from './cache/search-cache.service';
import { ClaudeSearchIntentService } from './ai-fallback/claude-search-intent.service';
import { AI_INTENT_PROVIDER } from './ai-fallback/ai-intent-provider.interface';

import { LogModule } from '../logger/log.module';

/**
 * AI Search.
 *
 * Five levels, cheapest first: cache → local dictionary/fuzzy parser → LLM
 * fallback, then SQL filtering and in-memory ranking. Only the fallback costs
 * money, and it only runs below the confidence threshold.
 *
 * The AI provider is bound through AI_INTENT_PROVIDER rather than injected
 * concretely, so swapping Claude for OpenAI/Azure means implementing
 * AiIntentProvider and changing this one binding.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Profile, User, Match, SearchHistory, SavedSearch]),
    LogModule,
    ConfigModule,
  ],
  controllers: [AiSearchController, AdminSearchAnalyticsController],
  providers: [
    AiSearchService,
    SearchQueryBuilderService,
    SearchAnalyticsService,
    SavedSearchService,
    SearchSuggestionService,
    SearchIntentParserService,
    FuzzyMatchService,
    SynonymService,
    MatchRankingService,
    SearchCacheService,
    ClaudeSearchIntentService,
    { provide: AI_INTENT_PROVIDER, useExisting: ClaudeSearchIntentService },
    {
      provide: Anthropic,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) =>
        new Anthropic({ apiKey: configService.get<string>('CLAUDE_API_KEY') }),
    },
  ],
  exports: [AiSearchService, SearchIntentParserService, SynonymService],
})
export class SearchModule {}
