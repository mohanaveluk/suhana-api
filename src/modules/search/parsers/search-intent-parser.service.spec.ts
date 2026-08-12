import { Test, TestingModule } from '@nestjs/testing';

import { SearchIntentParserService } from './search-intent-parser.service';
import { FuzzyMatchService } from './fuzzy-match.service';
import { SynonymService } from './synonym.service';
import { CONFIDENCE_THRESHOLD } from '../enums/search.enums';

describe('SearchIntentParserService', () => {
  let parser: SearchIntentParserService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SearchIntentParserService, FuzzyMatchService, SynonymService],
    }).compile();

    parser = module.get(SearchIntentParserService);
  });

  const parse = (q: string) => parser.parse(q).intent;

  // ── The queries named in the specification ────────────────────────────────
  describe('specified example queries', () => {
    it('"Find me a caring, family-oriented doctor in Texas"', () => {
      const intent = parse('Find me a caring, family-oriented doctor in Texas');

      expect(intent.profession).toBe('Doctor');
      expect(intent.state).toBe('Texas');
      expect(intent.personalityTraits).toEqual(
        expect.arrayContaining(['caring', 'family-oriented']),
      );
    });

    it('"Show Tamil speaking software engineers willing to relocate"', () => {
      const intent = parse('Show Tamil speaking software engineers willing to relocate');

      expect(intent.profession).toBe('Software Engineer');
      expect(intent.languages).toContain('Tamil');
      expect(intent.willingToRelocate).toBe(true);
    });

    it('"Find a bride who values family more than career"', () => {
      const intent = parse('Find a bride who values family more than career');

      expect(intent.gender).toBe('bride');
      expect(intent.familyValues).toBe('traditional');
      expect(intent.personalityTraits).toContain('family-oriented');
    });

    it('"Show highly educated Hindu matches in California"', () => {
      const intent = parse('Show highly educated Hindu matches in California');

      expect(intent.education).toBe('Masters');
      expect(intent.religion).toBe('Hindu');
      expect(intent.state).toBe('California');
    });

    it('"Find profiles similar to Nandhini"', () => {
      const intent = parse('Find profiles similar to Nandhini');
      expect(intent.similarToName).toBe('Nandhini');
    });

    it('"Find someone who values family more than career" → traditional + family-oriented', () => {
      const intent = parse('Find someone who values family more than career');

      expect(intent.familyValues).toBe('traditional');
      expect(intent.personalityTraits).toContain('family-oriented');
    });
  });

  // ── Advanced matrimony intents ────────────────────────────────────────────
  describe('advanced matrimony queries', () => {
    it('recognises verified premium members with a location', () => {
      const intent = parse('Find verified premium members in Texas');

      expect(intent.verifiedOnly).toBe(true);
      expect(intent.premiumOnly).toBe(true);
      expect(intent.state).toBe('Texas');
    });

    it('converts "active in the last 30 days" to a day count', () => {
      expect(parse('Show profiles active in the last 30 days').activeWithinDays).toBe(30);
    });

    it('converts a week-based activity window to days', () => {
      expect(parse('Show profiles active in the last 2 weeks').activeWithinDays).toBe(14);
    });

    it('extracts a numeric AI match-score floor', () => {
      const intent = parse('Find highly compatible profiles with 85%+ AI match score');
      expect(intent.minMatchScore).toBe(85);
    });

    it('flags shortlist-similarity queries', () => {
      const intent = parse('Show matches similar to my top 3 shortlisted profiles');
      expect(intent.similarToShortlisted).toBe(true);
    });

    it('reads parental approval as traditional values plus horoscope', () => {
      const intent = parse('Find matches my parents would like');

      expect(intent.familyApproval).toBe(true);
      expect(intent.familyValues).toBe('traditional');
      expect(intent.horoscopeRequired).toBe(true);
    });

    it('"Find profiles my family may approve" resolves the same way', () => {
      const intent = parse('Find profiles my family may approve');
      expect(intent.familyApproval).toBe(true);
    });

    it('handles a compound query — language, profession and relocation', () => {
      const intent = parse('Find Tamil-speaking doctors willing to relocate');

      expect(intent.languages).toContain('Tamil');
      expect(intent.profession).toBe('Doctor');
      expect(intent.willingToRelocate).toBe(true);
    });

    it('detects horoscope and family-values intent together', () => {
      const intent = parse('Show matches with excellent horoscope and family values');
      expect(intent.horoscopeRequired).toBe(true);
    });
  });

  // ── Marital status ────────────────────────────────────────────────────────
  describe('marital status', () => {
    it.each([
      ['Find an unmarried doctor', 'Never Married'],
      ['Show single profiles in Texas', 'Never Married'],
      ['Find a never married bride', 'Never Married'],
      ['Show divorced profiles', 'Divorced'],
      ['Find a widowed groom', 'Widowed'],
      ['Show separated profiles', 'Awaiting Divorce'],
      ['Find someone awaiting divorce', 'Awaiting Divorce'],
      ['Show annulled marriages', 'Annulled'],
    ])('%s → %s', (query, expected) => {
      expect(parse(query).maritalStatus).toBe(expected);
    });

    it('treats "second marriage" as openness to any previously-married status', () => {
      const intent = parse('Looking for a second marriage');

      expect(intent.openToRemarriage).toBe(true);
      // Not pinned to one specific status.
      expect(intent.maritalStatus).toBeUndefined();
    });

    it('treats "open to divorcee" the same way', () => {
      expect(parse('Open to divorcee profiles').openToRemarriage).toBe(true);
    });
  });

  // ── interests / interests ───────────────────────────────────────────────────
  describe('interests', () => {
    it.each([
      ['Find someone who loves travelling', 'travel'],
      ['Show profiles interested in cooking', 'cooking'],
      ['Find a bride who likes carnatic music', 'music'],
      ['Show people who enjoy trekking', 'travel'],
      ['Find someone into photography', 'photography'],
      ['Show profiles who like painting', 'art'],
      ['Find someone who does social work', 'volunteering'],
      ['Show profiles who love dogs', 'pets'],
    ])('%s → %s', (query, expected) => {
      expect(parse(query).interests).toContain(expected);
    });

    it('extracts several interests from one query', () => {
      const intent = parse('Find someone who loves travel, cooking and music');
      expect(intent.interests).toEqual(
        expect.arrayContaining(['travel', 'cooking', 'music']),
      );
    });

    it('extracts interests alongside a profession', () => {
      const intent = parse('Find a doctor who loves travel');
      expect(intent.profession).toBe('Doctor');
      expect(intent.interests).toContain('travel');
    });
  });

  // ── Fuzzy typo correction ─────────────────────────────────────────────────
  describe('typo tolerance', () => {
    it.each([
      ['Find a docotr in Texas', 'profession', 'Doctor'],
      ['Show sofware developers', 'profession', 'Software Engineer'],
      ['Find an enginer', 'profession', 'Engineer'],
    ])('%s → %s = %s', (query, field, expected) => {
      expect(parse(query)[field as 'profession']).toBe(expected);
    });

    it('corrects a misspelled state', () => {
      expect(parse('Find a doctor in Calfornia').state).toBe('California');
    });

    it('reports what it corrected', () => {
      const result = parser.parse('Find a docotr in Texas');
      expect(Object.values(result.corrections)).toContain('Doctor');
    });
  });

  // ── Synonym canonicalisation ──────────────────────────────────────────────
  describe('synonym mapping', () => {
    it.each([
      ['physician', 'Doctor'],
      ['surgeon', 'Doctor'],
      ['programmer', 'Software Engineer'],
      ['developer', 'Software Engineer'],
      ['educator', 'Teacher'],
      ['advocate', 'Lawyer'],
      ['chartered accountant', 'Chartered Accountant'],
    ])('maps "%s" to %s', (surface, canonical) => {
      expect(parse(`Find a ${surface} in Texas`).profession).toBe(canonical);
    });

    it('prefers the longest matching phrase', () => {
      // "software engineer" must win over the bare "engineer".
      expect(parse('Find a software engineer').profession).toBe('Software Engineer');
    });
  });

  // ── Age parsing ───────────────────────────────────────────────────────────
  describe('age extraction', () => {
    it('parses an explicit range', () => {
      const intent = parse('Find a doctor between 25 and 30');
      expect(intent.ageMin).toBe(25);
      expect(intent.ageMax).toBe(30);
    });

    it('parses a hyphenated range', () => {
      const intent = parse('Show profiles 28-34 years');
      expect(intent.ageMin).toBe(28);
      expect(intent.ageMax).toBe(34);
    });

    it('parses an upper bound', () => {
      const intent = parse('Find someone under 30');
      expect(intent.ageMax).toBe(30);
      expect(intent.ageMin).toBeUndefined();
    });

    it('parses a lower bound', () => {
      const intent = parse('Find someone above 25');
      expect(intent.ageMin).toBe(25);
      expect(intent.ageMax).toBeUndefined();
    });

    it('ignores implausible ages', () => {
      const intent = parse('Find someone under 12');
      expect(intent.ageMax).toBeUndefined();
    });

    it('does not read a percentage as an age', () => {
      const intent = parse('Find profiles with 85%+ match score');
      expect(intent.ageMin).toBeUndefined();
      expect(intent.ageMax).toBeUndefined();
      expect(intent.minMatchScore).toBe(85);
    });
  });

  // ── Confidence scoring ────────────────────────────────────────────────────
  describe('confidence scoring', () => {
    it('scores a rich query at or above the AI-fallback threshold', () => {
      const result = parser.parse(
        'Find a caring Tamil speaking doctor with a Masters in Texas',
      );
      // profession 30 + location 20 + traits 20 + education 20 + language 10
      expect(result.confidence).toBeGreaterThanOrEqual(CONFIDENCE_THRESHOLD);
    });

    it('scores an unparseable query at zero, triggering the fallback', () => {
      const result = parser.parse('someone nice for me please');
      expect(result.confidence).toBeLessThan(CONFIDENCE_THRESHOLD);
    });

    it('scores an empty query at zero without throwing', () => {
      expect(parser.parse('').confidence).toBe(0);
      expect(parser.parse('   ').confidence).toBe(0);
    });

    it('never exceeds 100', () => {
      const result = parser.parse(
        'caring family-oriented Tamil Telugu doctor engineer Masters PhD Texas California Dallas',
      );
      expect(result.confidence).toBeLessThanOrEqual(100);
    });

    it('weights profession highest, as specified', () => {
      expect(parser.parse('Find a doctor').confidence).toBe(30);
      expect(parser.parse('Find someone in Texas').confidence).toBe(20);
      expect(parser.parse('Find a Tamil speaker').confidence).toBe(10);
    });
  });

  // ── Robustness ────────────────────────────────────────────────────────────
  describe('robustness', () => {
    it('handles an empty query without throwing', () => {
      expect(() => parser.parse('')).not.toThrow();
      expect(parser.parse('').intent).toEqual({});
    });

    it('handles null/undefined input', () => {
      expect(() => parser.parse(undefined as any)).not.toThrow();
      expect(() => parser.parse(null as any)).not.toThrow();
    });

    it('does not treat pronouns as a gender filter', () => {
      // "her family" is not a request for a bride.
      expect(parse('Find someone who values her family').gender).toBeUndefined();
    });

    it('strips punctuation without losing facets', () => {
      const intent = parse('Find me a caring, family-oriented doctor -- in Texas!!');
      expect(intent.profession).toBe('Doctor');
      expect(intent.state).toBe('Texas');
    });

    it('is case insensitive', () => {
      const upper = parse('FIND A DOCTOR IN TEXAS');
      expect(upper.profession).toBe('Doctor');
      expect(upper.state).toBe('Texas');
    });

    it('excludes stop words and claimed terms from keywords', () => {
      const intent = parse('Find me a doctor in Texas');
      expect(intent.keywords).not.toContain('find');
      expect(intent.keywords).not.toContain('doctor');
      expect(intent.keywords).not.toContain('texas');
    });

    it('keeps city and state when both are named', () => {
      const intent = parse('Show software engineers in Dallas, Texas');
      expect(intent.city).toBe('Dallas');
      expect(intent.state).toBe('Texas');
    });
  });
});
