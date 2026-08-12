import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Match, Profile } from '../../user/entity';
import { SearchIntentParserService } from '../parsers/search-intent-parser.service';
import { SearchQueryBuilderService } from './search-query-builder.service';
import { MatchRankingService, RankedProfile } from '../ranking/match-ranking.service';
import { SearchCacheService } from '../cache/search-cache.service';
import { SearchAnalyticsService } from './search-analytics.service';
import {
  AI_INTENT_PROVIDER, AiIntentProvider,
} from '../ai-fallback/ai-intent-provider.interface';
import {
  AiSearchRequestDto, AiSearchResponseDto, SearchProfileResultDto,
} from '../dto/ai-search.dto';
import { ParsedIntentResult, SearchIntent } from '../models/search-intent.model';
import { CONFIDENCE_THRESHOLD, IntentSource } from '../enums/search.enums';
import { CustomLoggerService } from '../../logger/custom-logger.service';
import { profile } from 'console';

export interface SearchContext {
  userId?: string | null;
  ipAddress?: string | null;
}

/** Static examples surfaced by the suggestions endpoint. */
export const SEARCH_SUGGESTIONS = [
  'Find a doctor in Texas',
  'Show software engineers in Dallas',
  'Find traditional Hindu matches',
  'Show Tamil speaking profiles',
  'Find profiles willing to relocate',
  'Find highly educated matches in California',
  'Show verified premium members in Texas',
  'Find Tamil-speaking doctors willing to relocate',
  'Show profiles active in the last 30 days',
  'Find someone who values family more than career',
  'Show matches with excellent horoscope and family values',
  'Find a caring, family-oriented bride in Chennai',
];

@Injectable()
export class AiSearchService {
  constructor(
    @InjectRepository(Profile) private readonly profileRepo: Repository<Profile>,
    @InjectRepository(Match) private readonly matchRepo: Repository<Match>,
    private readonly parser: SearchIntentParserService,
    private readonly queryBuilder: SearchQueryBuilderService,
    private readonly ranking: MatchRankingService,
    private readonly cache: SearchCacheService,
    private readonly analytics: SearchAnalyticsService,
    @Inject(AI_INTENT_PROVIDER) private readonly aiProvider: AiIntentProvider,
    private readonly logger: CustomLoggerService,
  ) {}

  // ─── Main entry point ──────────────────────────────────────────────────────

  async search(dto: AiSearchRequestDto, ctx: SearchContext = {}): Promise<AiSearchResponseDto> {
    const startedAt = Date.now();
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;

    const parsed = await this.resolveIntent(dto.query, dto.refreshIntent === true);

    // "Similar to <name>" and "similar to my shortlisted" widen the intent
    // before it reaches SQL.
    const shortlistedUserIds = parsed.intent.similarToShortlisted && ctx.userId
      ? await this.shortlistedUserIds(ctx.userId)
      : undefined;

    if (parsed.intent.similarToName) {
      await this.mergeIntentFromNamedProfile(parsed.intent);
    }

    const { profiles, total } = await this.runQuery(
      parsed.intent, page, limit, { excludeUserId: ctx.userId, shortlistedUserIds },
    );

    const ranked = this.ranking.rank(profiles, parsed.intent);
    const filtered = parsed.intent.minMatchScore
      ? ranked.filter((r) => r.score >= parsed.intent.minMatchScore!)
      : ranked;

    const searchTimeMs = Date.now() - startedAt;

    // Analytics is deliberately not awaited — it must never add latency to a
    // search, and its own errors are handled internally.
    void this.analytics.record({
      userId: ctx.userId,
      query: dto.query,
      intent: parsed.intent,
      confidence: parsed.confidence,
      intentSource: parsed.source,
      resultCount: total,
      searchTimeMs,
      ipAddress: ctx.ipAddress,
    });

    return {
      searchIntent: parsed.intent,
      confidence: parsed.confidence,
      intentSource: parsed.source,
      totalResults: total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      profiles: filtered.map((r) => this.toResultDto(r)),
      suggestions: this.buildSuggestions(parsed.intent, total),
      corrections: parsed.corrections,
      searchTimeMs,
    };
  }

  /**
   * Levels 1-5 in order: cache → local parser → (if unconvincing) LLM.
   *
   * The AI result is *merged into* the local parse rather than replacing it —
   * the local parser is reliable on the facets it does recognise, and the model
   * is only there to fill gaps.
   */
  private async resolveIntent(query: string, refresh: boolean): Promise<ParsedIntentResult> {
    if (!refresh) {
      const cached = await this.cache.getIntent(query);
      if (cached) return { ...cached, source: IntentSource.CACHE };
    }

    const local = this.parser.parse(query);

    if (local.confidence >= CONFIDENCE_THRESHOLD) {
      await this.cache.setIntent(query, local);
      return local;
    }

    if (!this.aiProvider.isAvailable()) {
      // No provider configured — proceed with what we have rather than failing.
      return { ...local, source: IntentSource.LOCAL_DEGRADED };
    }

    const aiIntent = await this.aiProvider.extractIntent(query);
    if (!aiIntent) {
      // Not cached: a transient provider failure should not poison the cache
      // with a degraded parse for the next 30 days.
      return {
        ...local,
        source: IntentSource.LOCAL_DEGRADED,
        fallbackError: 'AI intent extraction unavailable',
      };
    }

    const merged: ParsedIntentResult = {
      intent: this.mergeIntents(local.intent, aiIntent),
      // The LLM was consulted precisely because the local parse was thin; report
      // its confidence honestly rather than inventing a high number.
      confidence: Math.max(local.confidence, CONFIDENCE_THRESHOLD),
      source: IntentSource.AI_FALLBACK,
      matchedFacets: local.matchedFacets,
      corrections: local.corrections,
    };

    await this.cache.setIntent(query, merged);
    return merged;
  }

  /** Local values win; the AI only fills fields the parser left empty. */
  private mergeIntents(local: SearchIntent, ai: Partial<SearchIntent>): SearchIntent {
    const merged: SearchIntent = { ...local };

    for (const [key, value] of Object.entries(ai)) {
      if (value === undefined || value === null) continue;
      if (Array.isArray(value) && !value.length) continue;

      const current = merged[key as keyof SearchIntent];
      const isEmpty =
        current === undefined ||
        current === null ||
        (Array.isArray(current) && current.length === 0);

      if (isEmpty) (merged as any)[key] = value;
    }
    return merged;
  }

  // ─── Query execution ───────────────────────────────────────────────────────

  private async runQuery(
    intent: SearchIntent,
    page: number,
    limit: number,
    options: { excludeUserId?: string | null; shortlistedUserIds?: string[] },
  ): Promise<{ profiles: Profile[]; total: number }> {
    const qb = this.queryBuilder.build(this.profileRepo, intent, {
      excludeUserId: options.excludeUserId ?? undefined,
      shortlistedUserIds: options.shortlistedUserIds,
    });

    // // Join user table
    // qb.leftJoinAndSelect('p.user', 'u');

    // // Apply active/searchable filters
    // qb.andWhere('u.is_active = :isActive', { isActive: 1 })
    //   .andWhere('p.is_searchable = :isSearchable', { isSearchable: 1 });      

    // Ranking happens in memory, so the page must be fetched before scoring.
    // Ordering by recency here gives a stable, sensible page to rank within.
    const [profiles, total] = await qb
      .orderBy('p.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    for (const profile of profiles) {
      if (profile.photos?.length) {
        profile.photos = profile.photos.filter((ph) => ph.isActive === 1);
      }
    }

    return { profiles, total };
  }

  // ─── Similar profiles ──────────────────────────────────────────────────────

  /**
   * Profiles resembling a given one. Builds an intent from the reference
   * profile's own attributes and runs it through the same pipeline, so "similar"
   * means the same thing here as everywhere else.
   */
  async findSimilar(
    profileId: string,
    limit: number,
    ctx: SearchContext = {},
  ): Promise<AiSearchResponseDto> {
    const startedAt = Date.now();

    const reference = await this.profileRepo.findOne({
      where: { id: profileId },
      relations: ['user'],
    });
    if (!reference) throw new NotFoundException('Profile not found');

    const intent = this.intentFromProfile(reference);

    const qb = this.queryBuilder.build(this.profileRepo, intent, {
      excludeUserId: ctx.userId ?? undefined,
    });
    // Never return the reference profile as its own match.
    qb.andWhere('p.id != :refId', { refId: profileId });

    const [profiles, total] = await qb
      .orderBy('p.createdAt', 'DESC')
      .take(limit)
      .getManyAndCount();

    for (const profile of profiles) {
      if (profile.photos?.length) {
        profile.photos = profile.photos.filter((ph) => ph.isActive === 1);
      }
    }

    const ranked = this.ranking.rank(profiles, intent);
    const searchTimeMs = Date.now() - startedAt;

    return {
      searchIntent: intent,
      confidence: 100, // derived from a real profile, not from parsing free text
      intentSource: IntentSource.LOCAL,
      totalResults: total,
      page: 1,
      limit,
      totalPages: 1,
      profiles: ranked.map((r) => this.toResultDto(r)),
      suggestions: [],
      corrections: {},
      searchTimeMs,
    };
  }

  /** Distils a profile into the intent that would have found people like it. */
  private intentFromProfile(profile: Profile): SearchIntent {
    const intent: SearchIntent = {};

    if (profile.occupationTitle) intent.profession = profile.occupationTitle;
    if (profile.educationLevel) intent.education = profile.educationLevel;
    if (profile.religion) intent.religion = profile.religion;
    if (profile.caste) intent.caste = profile.caste;
    if (profile.city) intent.city = profile.city;
    if (profile.state) intent.state = profile.state;
    if (profile.motherTongue) intent.languages = [profile.motherTongue];
    if (profile.familyType) intent.familyType = profile.familyType;
    if (profile.familyValues) intent.familyValues = profile.familyValues;
    if (profile.interests) intent.interests = profile.interests;
    // Deliberately not copied: hobbies and maritalStatus would over-constrain a
    // "similar profiles" query into near-emptiness. They contribute via ranking.

    // Look for the opposite gender — a "similar profile" in matrimony means a
    // comparable match, not another candidate of the same gender.
    if (profile.gender) {
      intent.gender = profile.gender === 'bride' ? 'groom' : 'bride';
    }

    // A comparable age band rather than an exact age.
    if (profile.age) {
      intent.ageMin = Math.max(18, profile.age - 5);
      intent.ageMax = Math.min(80, profile.age + 5);
    }

    if (profile.horoscope?.rashi || profile.horoscope?.nakshatra) {
      intent.horoscopeRequired = true;
    }

    const traits = [
      ...(profile.partnerExpectations ?? []),
      ...(profile.lifestyleHabits ?? []),
    ].slice(0, 5);
    if (traits.length) intent.personalityTraits = traits;

    return intent;
  }

  /**
   * Resolves "profiles similar to Nandhini" by finding that member and folding
   * their attributes into the intent. Silently no-ops when the name is ambiguous
   * or unknown — a failed name lookup should narrow nothing.
   */
  private async mergeIntentFromNamedProfile(intent: SearchIntent): Promise<void> {
    const name = intent.similarToName;
    if (!name) return;

    const matches = await this.profileRepo.find({
      where: { firstName: name },
      take: 2,
    });

    if (matches.length !== 1) return; // ambiguous or not found

    const derived = this.intentFromProfile(matches[0]);
    for (const [key, value] of Object.entries(derived)) {
      const current = intent[key as keyof SearchIntent];
      if (current === undefined || current === null) {
        (intent as any)[key] = value;
      }
    }
  }

  private async shortlistedUserIds(userId: string): Promise<string[]> {
    const rows = await this.matchRepo.find({
      where: { userId, status: 'shortlisted' },
      select: ['matchedUserId'],
      take: 200,
    });
    return rows.map((r) => r.matchedUserId).filter(Boolean);
  }

  // ─── Suggestions ───────────────────────────────────────────────────────────

  getSuggestions(): string[] {
    return SEARCH_SUGGESTIONS;
  }

  /**
   * Follow-ups shown beneath the results. When a search returns little, these
   * become corrective ("try removing the location") rather than decorative —
   * an empty result set is where a member most needs a way forward.
   */
  private buildSuggestions(intent: SearchIntent, total: number): string[] {
    if (total === 0) {
      const relaxations: string[] = [];

      if (intent.city && intent.state) {
        relaxations.push(`Search all of ${intent.state} instead of ${intent.city}`);
      } else if (intent.city || intent.state) {
        relaxations.push('Try removing the location filter');
      }
      if (intent.ageMin !== undefined || intent.ageMax !== undefined) {
        relaxations.push('Try widening the age range');
      }
      if (intent.profession) {
        relaxations.push(`Search for related professions instead of ${intent.profession}`);
      }
      if (intent.premiumOnly || intent.verifiedOnly) {
        relaxations.push('Include all members, not only verified or premium ones');
      }
      if (intent.activeWithinDays) {
        relaxations.push('Include members who were active longer ago');
      }

      return relaxations.length
        ? relaxations.slice(0, 4)
        : SEARCH_SUGGESTIONS.slice(0, 4);
    }

    // Healthy result set — offer ways to narrow it down.
    const refinements: string[] = [];
    if (!intent.city && !intent.state) refinements.push('Add a city or state to narrow results');
    if (!intent.education) refinements.push('Filter by education level');
    if (!intent.languages?.length) refinements.push('Add a mother tongue, e.g. Tamil or Telugu');
    if (!intent.personalityTraits?.length) {
      refinements.push('Describe the personality you are looking for');
    }

    return refinements.slice(0, 3);
  }

  // ─── Mapping ───────────────────────────────────────────────────────────────

  private toResultDto(ranked: RankedProfile): SearchProfileResultDto {
    const p = ranked.profile;
    const primary = p.photos?.find((ph) => ph.isPrimary) ?? p.photos?.[0];
    if (p.user) {
      p.user.mobile = '**********';
    }

    return {
      userId: p.user?.id ?? null,
      user: p.user ?? null,
      profileId: p.id,
      profileCode: p.profileCode ?? null,
      firstName: p.firstName ?? 'Member',
      lastName: p.lastName ?? null,
      age: p.age ?? null,
      dateOfBirth: p.dateOfBirth ?? null,
      gender: p.gender ?? null,
      occupationTitle: p.occupationTitle ?? null,
      educationLevel: p.educationLevel ?? null,
      caste: p.caste ?? null,
      religion: p.religion ?? null,
      motherTongue: p.motherTongue ?? null,
      location: {
        city: p.city ?? null,
        state: p.state ?? null,
        country: p.country ?? null,
        willingToRelocate: Boolean(p.willingToRelocate),
      },
      education: {
        level: p.educationLevel ?? null,
        field: p.educationField ?? null,
        institution: p.institution ?? null,
      },
      occupation: {
        title: p.occupationTitle ?? null,
        company: p.company ?? null,
        annualIncome: p.annualIncome ?? null,
        workingStatus: p.workingStatus ?? null,
      },
      familyDetails: {
        familyType: p.familyType ?? null,
        fatherOccupation: p.fatherOccupation ?? null,
        motherOccupation: p.motherOccupation ?? null,
        siblings: p.siblings ?? null,
        familyValues: p.familyValues ?? null,
        familyPreferenceNote: p.familyPreferenceNote ?? null,
      },      
      photos: (p.photos || []).map((ph) => ({
        id: ph.id,
        url: ph.url,
        variants: ph.variants,
        createdAt: ph.createdAt,
        isPrimary: ph.isPrimary,
        isVerified: ph.isVerified,
      })),      
      height: p.height ?? null,
      weight: p.weight ?? null,
      complexion: p.complexion ?? null,
      aboutMe: p.aboutMe ?? null,
      familyType: p.familyType ?? null,
      maritalStatus: p.maritalStatus ?? null,
      interests: p.interests ?? [],
      photoPrivacy: p.photoPrivacy ?? null,
      status: p.status ?? null,
      profileCompleteness: p.profileCompleteness ?? null,
      videoIntroUrl: p.videoIntroUrl ?? null,
      willingToRelocate: Boolean(p.willingToRelocate),
      primaryPhotoUrl: primary?.url ?? null,
      voiceIntroductionUrl: p.voiceIntroductionUrl ?? null,
      matchScore: ranked.score,
      scoreBreakdown: ranked.breakdown,
      matchReasons: ranked.reasons,
      lastActive: p.user?.last_active ?? null,
    };
  }
}
