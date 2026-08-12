import { SearchSuggestionService } from './search-suggestion.service';
import { SearchIntentParserService } from '../parsers/search-intent-parser.service';
import { FuzzyMatchService } from '../parsers/fuzzy-match.service';
import { SynonymService } from '../parsers/synonym.service';
import { SuggestionType } from '../dto/ai-search.dto';

describe('SearchSuggestionService', () => {
  const synonyms = new SynonymService();
  const parser = new SearchIntentParserService(new FuzzyMatchService(), synonyms);

  /**
   * Builds the service with a stubbed catalogue. `rows` maps a column to the
   * grouped values the profile aggregate would return; omitting it makes the
   * repository throw, exercising the seed-catalogue fallback.
   */
  const makeService = (
    rows?: Record<string, string[]>,
    popular: Array<{ query: string; searchCount: number; averageResults: number }> = [],
  ) => {
    const repo: any = {
      createQueryBuilder: () => {
        if (!rows) throw new Error('database unavailable');
        let column = '';
        const qb: any = {
          select: (expr: string) => {
            column = expr.replace('p.', '');
            return qb;
          },
          addSelect: () => qb,
          where: () => qb,
          andWhere: () => qb,
          groupBy: () => qb,
          orderBy: () => qb,
          limit: () => qb,
          getRawMany: async () =>
            (rows[column] ?? []).map((value, i) => ({ value, count: String(100 - i) })),
        };
        return qb;
      },
    };

    const cache: any = { getJson: async () => null, setJson: async () => undefined };
    const analytics: any = { getPopularSearches: async () => popular };
    const logger: any = { warn: jest.fn(), log: jest.fn(), error: jest.fn() };

    return new SearchSuggestionService(repo, parser, synonyms, cache, analytics, logger);
  };

  const texts = (items: Array<{ text: string }>) => items.map((i) => i.text);

  describe('refinements for a partial query', () => {
    it('suggests the facets "Hindu bride" has not constrained', async () => {
      const service = makeService();
      const result = await service.suggest('Hindu bride', 6);

      const facets = result.map((r) => r.facet);
      expect(facets).toEqual(expect.arrayContaining(['state', 'profession', 'education', 'age']));

      // Every suggestion builds on what was typed.
      for (const item of result) {
        expect(item.text.toLowerCase()).toContain('hindu bride');
      }
    });

    it('does not re-suggest a facet the query already names', async () => {
      const service = makeService();
      const result = await service.suggest('doctor in Texas', 8);

      const facets = result.map((r) => r.facet);
      expect(facets).not.toContain('profession'); // "doctor" already given
      expect(facets).not.toContain('state');      // "Texas" already given
      expect(facets).toEqual(expect.arrayContaining(['education', 'age']));
    });

    it('offers one suggestion per facet before a second of any', async () => {
      const service = makeService();
      const result = await service.suggest('Hindu bride', 5);

      const facets = result.map((r) => r.facet);
      expect(new Set(facets).size).toBe(facets.length);
    });

    it('respects the limit', async () => {
      const service = makeService();
      expect(await service.suggest('Hindu bride', 3)).toHaveLength(3);
    });

    it('never returns duplicates', async () => {
      const service = makeService();
      const result = await service.suggest('Hindu bride', 20);
      const lowered = texts(result).map((t) => t.toLowerCase());

      expect(new Set(lowered).size).toBe(lowered.length);
    });
  });

  describe('word completion', () => {
    it('completes a half-typed final word first', async () => {
      const service = makeService();
      const result = await service.suggest('Hindu bri', 5);

      expect(result[0].type).toBe(SuggestionType.COMPLETION);
      expect(result[0].text).toBe('Hindu bride');
    });

    it('builds later refinements on the completed phrase, not the fragment', async () => {
      const service = makeService();
      const result = await service.suggest('Hindu bri', 5);

      for (const item of result.slice(1)) {
        expect(item.text).toContain('Hindu bride');
        expect(item.text).not.toMatch(/Hindu bri\b/);
      }
    });

    it('does not offer a completion for an already-complete word', async () => {
      const service = makeService();
      const result = await service.suggest('Hindu bride', 5);

      expect(result.every((r) => r.type !== SuggestionType.COMPLETION)).toBe(true);
    });

    it('ignores fragments too short to disambiguate', async () => {
      const service = makeService();
      const result = await service.suggest('Hindu br', 5);

      expect(result.every((r) => r.type !== SuggestionType.COMPLETION)).toBe(true);
    });
  });

  describe('grounding in real data', () => {
    it('suggests values that exist in the profile catalogue', async () => {
      const service = makeService({
        state: ['Ohio', 'Michigan'],
        city: ['Columbus'],
        occupationTitle: ['Nurse'],
        educationLevel: ['Bachelors'],
        motherTongue: ['Telugu'],
        religion: ['Christian'],
      });

      const joined = texts(await service.suggest('Hindu bride', 10)).join(' | ');

      expect(joined).toContain('Ohio');
      expect(joined).toContain('Nurse');
      // Seed defaults must not leak through when real data exists.
      expect(joined).not.toContain('Texas');
    });

    it('collapses profession variants onto one canonical suggestion', async () => {
      const service = makeService({
        state: ['Ohio'],
        occupationTitle: ['Physician', 'MBBS', 'Doctor', 'Nurse'],
      });

      const joined = texts(await service.suggest('Hindu bride', 10)).join(' | ');

      expect(joined).toContain('Doctor');
      expect(joined).not.toContain('Physician');
      expect(joined).not.toContain('MBBS');
    });

    it('falls back to seed values when the catalogue query fails', async () => {
      const service = makeService(); // repository throws
      const result = await service.suggest('Hindu bride', 6);

      expect(result.length).toBeGreaterThan(0);
      expect(texts(result).join(' ')).toContain('Texas');
    });
  });

  describe('empty input', () => {
    it('returns what members actually search for', async () => {
      const service = makeService(undefined, [
        { query: 'tamil doctors in texas', searchCount: 90, averageResults: 40 },
      ]);
      const result = await service.suggest('', 5);

      expect(result[0].type).toBe(SuggestionType.POPULAR);
      expect(result[0].text.toLowerCase()).toContain('tamil doctors');
    });

    it('skips popular queries that historically return nothing', async () => {
      const service = makeService(undefined, [
        { query: 'astronaut in antarctica', searchCount: 50, averageResults: 0 },
      ]);
      const result = await service.suggest('', 5);

      expect(texts(result).join(' ').toLowerCase()).not.toContain('astronaut');
    });

    it('tops up with curated examples', async () => {
      const service = makeService(undefined, []);
      const result = await service.suggest('', 5);

      expect(result).toHaveLength(5);
      expect(result.every((r) => r.type === SuggestionType.EXAMPLE)).toBe(true);
    });

    it('treats whitespace-only input as empty', async () => {
      const service = makeService();
      const result = await service.suggest('   ', 3);
      expect(result.every((r) => r.type === SuggestionType.EXAMPLE)).toBe(true);
    });
  });

  describe('robustness', () => {
    it('handles null and undefined input', async () => {
      const service = makeService();
      await expect(service.suggest(null as any, 3)).resolves.toBeDefined();
      await expect(service.suggest(undefined as any, 3)).resolves.toBeDefined();
    });

    it('does not throw on a query that parses to nothing', async () => {
      const service = makeService();
      await expect(service.suggest('zzzz qqqq', 5)).resolves.toBeDefined();
    });

    it('carries a canonical value on facet suggestions for client-side filtering', async () => {
      const service = makeService();
      const result = await service.suggest('Hindu bride', 6);

      const stateSuggestion = result.find((r) => r.facet === 'state');
      expect(stateSuggestion?.value).toBeTruthy();
    });
  });
});
