import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Profile } from '../../user/entity';
import { SearchIntentParserService } from '../parsers/search-intent-parser.service';
import { SynonymService } from '../parsers/synonym.service';
import { SearchCacheService } from '../cache/search-cache.service';
import { SearchAnalyticsService } from './search-analytics.service';
import { SearchIntent } from '../models/search-intent.model';
import { SuggestionItemDto, SuggestionType } from '../dto/ai-search.dto';
import { CustomLoggerService } from '../../logger/custom-logger.service';

/** Top real values per facet, used to fill suggestion slots. */
interface FacetCatalogue {
  states: string[];
  cities: string[];
  professions: string[];
  educationLevels: string[];
  languages: string[];
  religions: string[];
}

/**
 * Typeahead suggestions for the AI search box.
 *
 * Two properties drive the design:
 *
 * 1. **Entirely local.** This fires on every keystroke, so it never calls the
 *    LLM and never touches the profile table on the hot path. It reuses the
 *    existing intent parser to work out which facets the partial query *already*
 *    covers, then proposes the ones it is missing.
 *
 * 2. **Grounded in real data.** Slot values come from an aggregate over live
 *    profiles, cached for an hour — so it suggests "from Texas" only if there
 *    are searchable profiles in Texas. Hardcoded examples would send members
 *    down dead ends that return nothing.
 */
@Injectable()
export class SearchSuggestionService {
  private static readonly CACHE_KEY = 'search_facet_catalogue:v1';
  private static readonly CACHE_TTL_SECONDS = 60 * 60; // 1 hour
  private static readonly DEFAULT_LIMIT = 8;

  /** Fallbacks used only when the catalogue is empty (e.g. a fresh database). */
  private static readonly SEED_CATALOGUE: FacetCatalogue = {
    states: ['Texas', 'California', 'New York'],
    cities: ['Dallas', 'Houston', 'Chennai'],
    professions: ['Doctor', 'Software Engineer', 'Teacher'],
    educationLevels: ['Masters', 'Bachelors'],
    languages: ['Tamil', 'Telugu', 'Hindi'],
    religions: ['Hindu', 'Christian', 'Muslim'],
  };

  constructor(
    @InjectRepository(Profile) private readonly profileRepo: Repository<Profile>,
    private readonly parser: SearchIntentParserService,
    private readonly synonyms: SynonymService,
    private readonly cache: SearchCacheService,
    private readonly analytics: SearchAnalyticsService,
    private readonly logger: CustomLoggerService,
  ) {}

  /**
   * Suggestions for a partial query.
   *
   * With no input, returns what members actually search for (falling back to
   * curated examples). With input, returns completions of that input.
   */
  async suggest(rawQuery: string, limit = SearchSuggestionService.DEFAULT_LIMIT): Promise<SuggestionItemDto[]> {
    const query = (rawQuery ?? '').trim().replace(/\s+/g, ' ');
    if (!query) return this.emptyStateSuggestions(limit);

    const catalogue = await this.getFacetCatalogue();
    const suggestions: SuggestionItemDto[] = [];

    // 1. Finish the word being typed, before proposing anything new. Someone
    //    mid-word wants "Hindu bride", not "Hindu bri from Texas".
    const completions = this.completePartialWord(query);
    suggestions.push(...completions);

    // Refinements build on the completed phrase where there is one, so the
    // suggestion list stays coherent rather than mixing half-typed variants.
    const base = completions[0]?.text ?? query;
    const { intent } = this.parser.parse(base);

    // 2. Propose the facets the query has not covered yet.
    suggestions.push(...this.buildRefinements(base, intent, catalogue));

    return this.dedupe(suggestions).slice(0, limit);
  }

  // ─── Word completion ───────────────────────────────────────────────────────

  /**
   * Completes a half-typed final word against the dictionaries — "Hindu bri"
   * becomes "Hindu bride".
   *
   * Prefix matching only: a member three characters into a word wants the word
   * they are typing, and fuzzy matching at that length produces noise.
   */
  private completePartialWord(query: string): SuggestionItemDto[] {
    const words = query.split(' ');
    const last = words[words.length - 1].toLowerCase();

    // Too short to disambiguate, and a completed word needs no completion.
    if (last.length < 3) return [];

    const prefix = words.slice(0, -1).join(' ');
    const seen = new Set<string>();
    const results: SuggestionItemDto[] = [];

    const dictionaries = [
      'gender', 'religion', 'profession', 'language',
      'state', 'city', 'education', 'personality',
    ] as const;

    for (const name of dictionaries) {
      for (const entry of this.synonyms.get(name)) {
        for (const term of [entry.canonical, ...entry.synonyms]) {
          const lower = term.toLowerCase();
          // Already complete — nothing to suggest.
          if (lower === last) return [];
          if (!lower.startsWith(last) || seen.has(entry.canonical)) continue;

          seen.add(entry.canonical);
          results.push({
            text: this.titleCasePhrase(prefix ? `${prefix} ${term}` : term),
            type: SuggestionType.COMPLETION,
            facet: name,
            value: entry.canonical,
          });
          break;
        }
      }
    }

    // Shortest completion first — closest to what the member is typing.
    return results.sort((a, b) => a.text.length - b.text.length).slice(0, 3);
  }

  // ─── Refinements ───────────────────────────────────────────────────────────

  /**
   * Proposes the facets the query has not yet constrained.
   *
   * Ordered by how much each one narrows a matrimony search in practice:
   * location and profession first, then education, age, language and finally
   * the soft signals.
   */
  private buildRefinements(
    base: string,
    intent: SearchIntent,
    catalogue: FacetCatalogue,
  ): SuggestionItemDto[] {
    // Grouped by facet, then interleaved. A member scanning a short dropdown
    // learns more from one suggestion per facet than from three ways to pick a
    // state, so breadth beats depth here.
    const groups = new Map<string, SuggestionItemDto[]>();
    const phrase = base.replace(/[.,;]+$/, '');

    const add = (text: string, facet: string, value?: string) => {
      if (!groups.has(facet)) groups.set(facet, []);
      groups.get(facet)!.push({ text, type: SuggestionType.REFINEMENT, facet, value });
    };

    // Location
    if (!intent.state && !intent.city) {
      for (const state of catalogue.states.slice(0, 2)) {
        add(`${phrase} from ${state}`, 'state', state);
      }
      if (catalogue.cities.length) {
        add(`${phrase} in ${catalogue.cities[0]}`, 'city', catalogue.cities[0]);
      }
    }

    // Profession
    if (!intent.profession) {
      for (const profession of catalogue.professions.slice(0, 2)) {
        add(`${phrase} working as a ${profession}`, 'profession', profession);
      }
    }

    // Education
    if (!intent.education) {
      const level = catalogue.educationLevels[0] ?? 'Masters';
      add(`${phrase} with a ${this.educationPhrase(level)}`, 'education', level);
    }

    // Age
    if (intent.ageMin === undefined && intent.ageMax === undefined) {
      add(`${phrase} aged 25-30`, 'age', '25-30');
    }

    // Language
    if (!intent.languages?.length) {
      const language = catalogue.languages[0];
      if (language) add(`${phrase} who speaks ${language}`, 'language', language);
    }

    // Religion — only when the query has not already named one.
    if (!intent.religion && catalogue.religions.length) {
      add(`${catalogue.religions[0]} ${phrase}`, 'religion', catalogue.religions[0]);
    }

    // Soft signals last: they colour a search rather than narrowing it.
    if (!intent.personalityTraits?.length) {
      add(`${phrase} who is caring and family-oriented`, 'personalityTraits');
    }
    if (intent.willingToRelocate === undefined) {
      add(`${phrase} willing to relocate`, 'willingToRelocate', 'true');
    }
    if (!intent.interests?.length) {
      add(`${phrase} who loves travel`, 'interests', 'travel');
    }

    return this.interleave(groups);
  }

  /**
   * Flattens facet groups round-robin: one suggestion from each facet, then a
   * second from each, and so on. Preserves the insertion order of the facets,
   * which is already ranked by how much each one narrows a matrimony search.
   */
  private interleave(groups: Map<string, SuggestionItemDto[]>): SuggestionItemDto[] {
    const out: SuggestionItemDto[] = [];
    const lists = [...groups.values()];
    const deepest = Math.max(0, ...lists.map((l) => l.length));

    for (let round = 0; round < deepest; round++) {
      for (const list of lists) {
        if (list[round]) out.push(list[round]);
      }
    }
    return out;
  }

  // ─── Empty state ───────────────────────────────────────────────────────────

  /**
   * With nothing typed, real popular searches beat curated examples — they show
   * newcomers what the platform is actually used for. Curated examples fill any
   * shortfall so the list is never sparse on a young deployment.
   */
  private async emptyStateSuggestions(limit: number): Promise<SuggestionItemDto[]> {
    const out: SuggestionItemDto[] = [];

    try {
      const popular = await this.analytics.getPopularSearches(limit, 30);
      for (const entry of popular) {
        // Skip queries that historically return nothing — suggesting them just
        // walks members into an empty result set.
        if (entry.averageResults <= 0) continue;
        out.push({
          text: this.titleCasePhrase(entry.query),
          type: SuggestionType.POPULAR,
          facet: null,
          value: null,
        });
      }
    } catch (error: any) {
      this.logger.warn(`Popular-search suggestions unavailable: ${error?.message}`);
    }

    for (const example of SEARCH_SUGGESTION_EXAMPLES) {
      if (out.length >= limit) break;
      out.push({ text: example, type: SuggestionType.EXAMPLE, facet: null, value: null });
    }

    return this.dedupe(out).slice(0, limit);
  }

  // ─── Facet catalogue ───────────────────────────────────────────────────────

  /**
   * Top values per facet across searchable profiles.
   *
   * Six grouped queries, cached for an hour — never run on the typeahead hot
   * path more than once per hour per instance. Values are canonicalised so
   * "Physician" and "MBBS" both surface as the suggestion "Doctor".
   */
  private async getFacetCatalogue(): Promise<FacetCatalogue> {
    const cached = await this.cache.getJson<FacetCatalogue>(SearchSuggestionService.CACHE_KEY);
    if (cached) return cached;

    try {
      const [states, cities, professions, educationLevels, languages, religions] =
        await Promise.all([
          this.topValues('state'),
          this.topValues('city'),
          this.topValues('occupationTitle', 'profession'),
          this.topValues('educationLevel', 'education'),
          this.topValues('motherTongue', 'language'),
          this.topValues('religion', 'religion'),
        ]);

      const catalogue: FacetCatalogue = {
        states: states.length ? states : SearchSuggestionService.SEED_CATALOGUE.states,
        cities: cities.length ? cities : SearchSuggestionService.SEED_CATALOGUE.cities,
        professions: professions.length ? professions : SearchSuggestionService.SEED_CATALOGUE.professions,
        educationLevels: educationLevels.length ? educationLevels : SearchSuggestionService.SEED_CATALOGUE.educationLevels,
        languages: languages.length ? languages : SearchSuggestionService.SEED_CATALOGUE.languages,
        religions: religions.length ? religions : SearchSuggestionService.SEED_CATALOGUE.religions,
      };

      await this.cache.setJson(
        SearchSuggestionService.CACHE_KEY,
        catalogue,
        SearchSuggestionService.CACHE_TTL_SECONDS,
      );
      return catalogue;
    } catch (error: any) {
      // Suggestions are a convenience — never fail the request over them.
      this.logger.warn(`Facet catalogue unavailable, using seed values: ${error?.message}`);
      return SearchSuggestionService.SEED_CATALOGUE;
    }
  }

  private async topValues(
    column: keyof Profile & string,
    dictionary?: 'profession' | 'education' | 'language' | 'religion',
    limit = 5,
  ): Promise<string[]> {
    const rows = await this.profileRepo
      .createQueryBuilder('p')
      .select(`p.${column}`, 'value')
      .addSelect('COUNT(*)', 'count')
      .where('p.status = :status', { status: 'active' })
      .andWhere('p.is_searchable = :searchable', { searchable: 1 })
      .andWhere(`p.${column} IS NOT NULL`)
      .andWhere(`p.${column} != ''`)
      .groupBy(`p.${column}`)
      .orderBy('count', 'DESC')
      .limit(limit * 3) // over-fetch: canonicalising collapses variants
      .getRawMany<{ value: string; count: string }>();

    const seen = new Set<string>();
    const values: string[] = [];

    for (const row of rows) {
      const raw = (row.value ?? '').trim();
      if (!raw) continue;

      // Collapse "Physician"/"MBBS"/"Doctor" into one suggestion.
      const canonical = dictionary
        ? this.synonyms.canonicalise(dictionary, raw) ?? raw
        : raw;

      if (seen.has(canonical)) continue;
      seen.add(canonical);
      values.push(canonical);
      if (values.length >= limit) break;
    }

    return values;
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  /** "Masters" reads better as "Master's degree" in a suggestion. */
  private educationPhrase(level: string): string {
    switch (level) {
      case 'Masters': return "Master's degree";
      case 'Bachelors': return "Bachelor's degree";
      case 'Doctorate': return 'PhD';
      case 'Professional Degree': return 'professional degree';
      default: return `${level} qualification`;
    }
  }

  /** Capitalises the first letter only — the rest is already correctly cased. */
  private titleCasePhrase(value: string): string {
    if (!value) return value;
    return value.charAt(0).toUpperCase() + value.slice(1);
  }

  private dedupe(items: SuggestionItemDto[]): SuggestionItemDto[] {
    const seen = new Set<string>();
    return items.filter((item) => {
      const key = item.text.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
}

/** Curated starting points, used when there is no search history to draw on. */
export const SEARCH_SUGGESTION_EXAMPLES = [
  'Find a doctor in Texas',
  'Show software engineers in Dallas',
  'Find traditional Hindu matches',
  'Show Tamil speaking profiles',
  'Find profiles willing to relocate',
  'Find highly educated matches in California',
  'Show verified premium members in Texas',
  'Find someone who values family more than career',
];
