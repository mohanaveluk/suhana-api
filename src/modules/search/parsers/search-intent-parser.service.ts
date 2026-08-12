import { Injectable } from '@nestjs/common';

import { FuzzyMatchService } from './fuzzy-match.service';
import { SynonymService } from './synonym.service';
import { ParsedIntentResult, SearchIntent } from '../models/search-intent.model';
import {
  CONFIDENCE_WEIGHTS, IntentFacet, IntentSource,
} from '../enums/search.enums';
import { HIGH_EDUCATION_PHRASES, REMARRIAGE_PHRASES, STOP_WORDS } from '../dictionaries';

/**
 * Level 1 + 2 of the search stack: local NLP parsing and intent extraction.
 *
 * Runs entirely in-process against the dictionaries — no network, no inference,
 * sub-millisecond. Only when its own confidence score falls below the threshold
 * does the caller escalate to the LLM, so the overwhelming majority of searches
 * cost nothing.
 */
@Injectable()
export class SearchIntentParserService {
  constructor(
    private readonly fuzzy: FuzzyMatchService,
    private readonly synonyms: SynonymService,
  ) {}

  parse(rawQuery: string): ParsedIntentResult {
    const query = (rawQuery ?? '').trim();
    const intent: SearchIntent = {};
    const matchedFacets: string[] = [];
    const corrections: Record<string, string> = {};

    if (!query) {
      return {
        intent,
        confidence: 0,
        source: IntentSource.LOCAL,
        matchedFacets,
        corrections,
      };
    }

    const normalised = this.normalise(query);

    // Tokens consumed by one facet are off-limits to the others. Without this,
    // "doctor" is claimed as a profession and then fuzzy-matched a second time
    // against "doctorate", silently adding an education level nobody asked for.
    const claimed = new Set<string>();

    // Two phases, and the order matters. Every facet's *exact* scan runs first
    // so each real word is claimed by its rightful facet; only then is fuzzy
    // correction allowed to guess at what is left. Interleaving them lets an
    // earlier facet mis-claim a later facet's word — "texas" is within fuzzy
    // range of "teacher", so a single-phase parser reads "someone in Texas" as
    // a search for teachers.
    this.extractProfessionExact(normalised, intent, matchedFacets, claimed);
    this.extractEducationExact(normalised, intent, matchedFacets, claimed);
    this.extractLocationExact(normalised, intent, matchedFacets, claimed);
    this.extractLanguagesExact(normalised, intent, matchedFacets, claimed);

    this.extractProfessionFuzzy(normalised, intent, matchedFacets, corrections, claimed);
    this.extractEducationFuzzy(normalised, intent, matchedFacets, corrections, claimed);
    this.extractLocationFuzzy(normalised, intent, matchedFacets, corrections, claimed);
    this.extractLanguagesFuzzy(normalised, intent, matchedFacets, corrections, claimed);
    this.extractTraits(normalised, intent, matchedFacets);
    this.extractReligion(normalised, intent);
    this.extractFamily(normalised, intent);
    this.extractAge(normalised, intent);
    this.extractMaritalStatus(normalised, intent);
    this.extractGender(normalised, intent);
    this.extractHobbies(normalised, intent);
    this.extractBooleanIntents(normalised, intent);
    this.extractAdvancedIntents(normalised, intent);

    intent.keywords = this.extractKeywords(normalised, intent);

    return {
      intent,
      confidence: this.scoreConfidence(matchedFacets),
      source: IntentSource.LOCAL,
      matchedFacets,
      corrections,
    };
  }

  /**
   * Confidence = sum of the weights of the facets that were populated.
   *
   * Deliberately measures *coverage*, not correctness: a query naming a
   * profession and a state is well understood, whereas one where nothing matched
   * is not, and that is exactly the signal for whether the LLM is worth paying for.
   */
  scoreConfidence(matchedFacets: string[]): number {
    const unique = new Set(matchedFacets);
    let score = 0;
    for (const facet of unique) {
      score += CONFIDENCE_WEIGHTS[facet as keyof typeof CONFIDENCE_WEIGHTS] ?? 0;
    }
    return Math.min(100, score);
  }

  // ─── Facet extractors ──────────────────────────────────────────────────────

  // ── Phase 1: exact dictionary scans ──────────────────────────────────────

  private extractProfessionExact(
    text: string, intent: SearchIntent, facets: string[], claimed: Set<string>,
  ): void {
    const [hit] = this.fuzzy.findInText(text, 'profession', this.synonyms.get('profession'));
    if (!hit) return;

    intent.profession = hit.canonical;
    this.claim(claimed, hit.matched);
    facets.push(IntentFacet.PROFESSION);
  }

  private extractEducationExact(
    text: string, intent: SearchIntent, facets: string[], claimed: Set<string>,
  ): void {
    // "highly educated" names no level — treat as Masters-or-above.
    if (HIGH_EDUCATION_PHRASES.some((p) => text.includes(p))) {
      intent.education = 'Masters';
      facets.push(IntentFacet.EDUCATION);
      return;
    }

    const [hit] = this.fuzzy.findInText(text, 'education', this.synonyms.get('education'));
    if (!hit || claimed.has(hit.matched)) return;

    intent.education = hit.canonical;
    this.claim(claimed, hit.matched);
    facets.push(IntentFacet.EDUCATION);
  }

  private extractLocationExact(
    text: string, intent: SearchIntent, facets: string[], claimed: Set<string>,
  ): void {
    let found = false;

    // City before state: "Dallas" is more specific than "Texas", and a query
    // naming both should keep both.
    const [city] = this.fuzzy.findInText(text, 'city', this.synonyms.get('city'));
    if (city) {
      intent.city = city.canonical;
      this.claim(claimed, city.matched);
      found = true;
    }

    const [state] = this.fuzzy.findInText(text, 'state', this.synonyms.get('state'));
    if (state) {
      intent.state = state.canonical;
      this.claim(claimed, state.matched);
      found = true;
    }

    const [country] = this.fuzzy.findInText(text, 'country', this.synonyms.get('country'));
    if (country) {
      intent.country = country.canonical;
      this.claim(claimed, country.matched);
      found = true;
    }

    if (found) facets.push(IntentFacet.LOCATION);
  }

  private extractLanguagesExact(
    text: string, intent: SearchIntent, facets: string[], claimed: Set<string>,
  ): void {
    const hits = this.fuzzy
      .findInText(text, 'language', this.synonyms.get('language'), { multi: true })
      .filter((h) => !claimed.has(h.matched));
    if (!hits.length) return;

    intent.languages = hits.map((h) => h.canonical);
    hits.forEach((h) => this.claim(claimed, h.matched));
    facets.push(IntentFacet.LANGUAGE);
  }

  // ── Phase 2: fuzzy correction for facets still unresolved ────────────────

  private extractProfessionFuzzy(
    text: string,
    intent: SearchIntent,
    facets: string[],
    corrections: Record<string, string>,
    claimed: Set<string>,
  ): void {
    if (intent.profession) return;

    const [corrected] = this.fuzzy.correctTokens(
      this.correctionTokens(text), 'profession', this.synonyms.get('profession'), claimed,
    );
    if (!corrected) return;

    intent.profession = corrected.canonical;
    corrections[corrected.matched] = corrected.canonical;
    this.claim(claimed, corrected.matched);
    facets.push(IntentFacet.PROFESSION);
  }

  private extractEducationFuzzy(
    text: string,
    intent: SearchIntent,
    facets: string[],
    corrections: Record<string, string>,
    claimed: Set<string>,
  ): void {
    if (intent.education) return;

    const [corrected] = this.fuzzy.correctTokens(
      this.correctionTokens(text), 'education', this.synonyms.get('education'), claimed,
    );
    if (!corrected) return;

    intent.education = corrected.canonical;
    corrections[corrected.matched] = corrected.canonical;
    this.claim(claimed, corrected.matched);
    facets.push(IntentFacet.EDUCATION);
  }

  private extractLocationFuzzy(
    text: string,
    intent: SearchIntent,
    facets: string[],
    corrections: Record<string, string>,
    claimed: Set<string>,
  ): void {
    if (intent.city || intent.state || intent.country) return;

    // Typo path — "Calfornia", "Texass".
    const tokens = this.correctionTokens(text);
    const [stateFix] = this.fuzzy.correctTokens(tokens, 'state', this.synonyms.get('state'), claimed);
    const [cityFix] = this.fuzzy.correctTokens(tokens, 'city', this.synonyms.get('city'), claimed);

    if (stateFix) {
      intent.state = stateFix.canonical;
      corrections[stateFix.matched] = stateFix.canonical;
      this.claim(claimed, stateFix.matched);
    } else if (cityFix) {
      intent.city = cityFix.canonical;
      corrections[cityFix.matched] = cityFix.canonical;
      this.claim(claimed, cityFix.matched);
    } else {
      return;
    }

    facets.push(IntentFacet.LOCATION);
  }

  private extractLanguagesFuzzy(
    text: string,
    intent: SearchIntent,
    facets: string[],
    corrections: Record<string, string>,
    claimed: Set<string>,
  ): void {
    if (intent.languages?.length) return;

    const [corrected] = this.fuzzy.correctTokens(
      this.correctionTokens(text), 'language', this.synonyms.get('language'), claimed,
    );
    if (!corrected) return;

    intent.languages = [corrected.canonical];
    corrections[corrected.matched] = corrected.canonical;
    this.claim(claimed, corrected.matched);
    facets.push(IntentFacet.LANGUAGE);
  }

  private extractTraits(text: string, intent: SearchIntent, facets: string[]): void {
    const hits = this.fuzzy.findInText(
      text, 'personality', this.synonyms.get('personality'), { multi: true },
    );
    if (hits.length) {
      intent.personalityTraits = hits.map((h) => h.canonical);
      facets.push(IntentFacet.TRAITS);
    }
  }

  private extractReligion(text: string, intent: SearchIntent): void {
    const [hit] = this.fuzzy.findInText(text, 'religion', this.synonyms.get('religion'));
    if (hit) intent.religion = hit.canonical;
  }

  private extractFamily(text: string, intent: SearchIntent): void {
    const [type] = this.fuzzy.findInText(text, 'familyType', this.synonyms.get('familyType'));
    if (type) intent.familyType = type.canonical;

    const [values] = this.fuzzy.findInText(
      text, 'familyValues', this.synonyms.get('familyValues'),
    );
    if (values) intent.familyValues = values.canonical;

    // "values family more than career" is a values statement, not a trait, but
    // members phrase it as a personality description — record it as both.
    if (/family (more than|over|before) career|values family/.test(text)) {
      intent.familyValues = intent.familyValues ?? 'traditional';
      intent.personalityTraits = this.addUnique(intent.personalityTraits, 'family-oriented');
    }

    // A "traditional" trait implies traditional family values.
    if (intent.personalityTraits?.includes('traditional') && !intent.familyValues) {
      intent.familyValues = 'traditional';
    }
  }

  /**
   * Age phrasings, most specific first:
   *   "between 25 and 30" / "25 to 30" / "25-30"
   *   "under 30" / "below 30"    → max
   *   "above 25" / "over 25"     → min
   *   "in her 20s" / "30s"       → decade band
   */
  private extractAge(text: string, intent: SearchIntent): void {
    const range = /(?:between\s+)?(\d{2})\s*(?:-|–|to|and)\s*(\d{2})\s*(?:years|yrs|yo)?/.exec(text);
    if (range) {
      const [min, max] = [Number(range[1]), Number(range[2])].sort((a, b) => a - b);
      if (this.plausibleAge(min) && this.plausibleAge(max)) {
        intent.ageMin = min;
        intent.ageMax = max;
        return;
      }
    }

    const under = /(?:under|below|less than|younger than|upto|up to)\s+(\d{2})/.exec(text);
    if (under && this.plausibleAge(Number(under[1]))) {
      intent.ageMax = Number(under[1]);
    }

    const over = /(?:above|over|more than|older than|at least)\s+(\d{2})/.exec(text);
    if (over && this.plausibleAge(Number(over[1]))) {
      intent.ageMin = Number(over[1]);
    }

    const decade = /(?:in (?:his|her|their) )?(\d0)s\b/.exec(text);
    if (decade && !intent.ageMin && !intent.ageMax) {
      const base = Number(decade[1]);
      if (this.plausibleAge(base)) {
        intent.ageMin = base;
        intent.ageMax = base + 9;
      }
    }

    // A bare "28 year old" style age with no comparator.
    const exact = /(\d{2})\s*(?:year|yr)s?\s*old/.exec(text);
    if (exact && !intent.ageMin && !intent.ageMax) {
      const age = Number(exact[1]);
      if (this.plausibleAge(age)) {
        intent.ageMin = age - 2;
        intent.ageMax = age + 2;
      }
    }
  }

  private extractMaritalStatus(text: string, intent: SearchIntent): void {
    // "second marriage" / "open to divorcee" expresses openness to anyone
    // previously married, not a request for one specific status.
    if (REMARRIAGE_PHRASES.some((p) => text.includes(p))) {
      intent.openToRemarriage = true;
      return;
    }

    const [hit] = this.fuzzy.findInText(
      text, 'maritalStatus', this.synonyms.get('maritalStatus'),
    );
    if (hit) intent.maritalStatus = hit.canonical;
  }

  private extractGender(text: string, intent: SearchIntent): void {
    // Only trust an explicit noun ("bride", "groom", "girl", "boy"). Pronouns
    // are too weak a signal — "someone who values her family" is not a gender filter.
    const strong = ['bride', 'groom', 'girl', 'boy', 'woman', 'man', 'female', 'male'];
    for (const token of strong) {
      if (new RegExp(`(?<![a-z])${token}(?![a-z])`).test(text)) {
        intent.gender = this.synonyms.canonicalise('gender', token) ?? undefined;
        return;
      }
    }
  }

  private extractHobbies(text: string, intent: SearchIntent): void {
    const hits = this.fuzzy.findInText(text, 'hobby', this.synonyms.get('hobby'), { multi: true });
    if (hits.length) intent.interests = hits.map((h) => h.canonical);
  }

  private extractBooleanIntents(text: string, intent: SearchIntent): void {
    if (/willing to relocate|ready to relocate|can relocate|open to relocat|relocat/.test(text)) {
      intent.willingToRelocate = true;
    }
    if (/horoscope|kundli|kundali|jathagam|jatakam|astrolog|nakshatra|rashi|manglik/.test(text)) {
      intent.horoscopeRequired = true;
    }
  }

  /** Matrimony-specific intents that map to platform state rather than profile fields. */
  private extractAdvancedIntents(text: string, intent: SearchIntent): void {
    if (/premium member|premium|gold member|platinum member|paid member/.test(text)) {
      intent.premiumOnly = true;
    }
    if (/verified member|verified profile|verified|genuine profile/.test(text)) {
      intent.verifiedOnly = true;
    }

    // "active in the last 7 days" / "active recently"
    const active = /active (?:in the )?(?:last|past)\s+(\d+)\s*(day|week|month)/.exec(text);
    if (active) {
      const n = Number(active[1]);
      const unit = active[2];
      intent.activeWithinDays = unit === 'day' ? n : unit === 'week' ? n * 7 : n * 30;
    } else if (/recently active|active recently|online recently/.test(text)) {
      intent.activeWithinDays = 7;
    }

    // "85%+ AI match score" / "highly compatible"
    const score = /(\d{2})\s*%\s*(?:\+|or more|and above|above)?\s*(?:ai\s*)?(?:match|compatib)/.exec(text);
    if (score) {
      intent.minMatchScore = Number(score[1]);
    } else if (/highly compatible|excellent compatibility|best match/.test(text)) {
      intent.minMatchScore = 80;
    }

    if (/shortlist/.test(text)) intent.similarToShortlisted = true;

    if (/parents would (?:like|approve)|family (?:may|would) approve|family approval|parents approve/.test(text)) {
      intent.familyApproval = true;
      // Parental approval in this domain consistently means traditional values
      // plus horoscope compatibility — encode that rather than leaving it vague.
      intent.familyValues = intent.familyValues ?? 'traditional';
      intent.horoscopeRequired = true;
    }

    // "profiles similar to Nandhini" — capture the name for downstream resolution.
    const similar = /similar to\s+([a-z]+(?:\s+[a-z]+)?)/.exec(text);
    if (similar && !/my|shortlist/.test(similar[1])) {
      intent.similarToName = similar[1]
        .split(' ')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
    }
  }

  /**
   * Residual meaningful tokens — everything not claimed by a dictionary and not
   * a stop word. Used for a best-effort LIKE against aboutMe so an unrecognised
   * but meaningful word still influences results.
   */
  private extractKeywords(text: string, intent: SearchIntent): string[] {
    const claimed = new Set(
      [
        intent.profession, intent.education, intent.religion, intent.caste,
        intent.city, intent.state, intent.country, intent.familyType,
        intent.familyValues, intent.maritalStatus, intent.gender,
        ...(intent.languages ?? []),
        ...(intent.personalityTraits ?? []),
        ...(intent.interests ?? []),
      ]
        .filter(Boolean)
        .flatMap((v) => String(v).toLowerCase().split(/[\s-]+/)),
    );

    return this.tokens(text)
      .filter((t) => t.length > 2)
      .filter((t) => !STOP_WORDS.has(t))
      .filter((t) => !claimed.has(t))
      .filter((t) => !/^\d+$/.test(t))
      .slice(0, 10);
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  /** Lower-cases, strips punctuation and collapses whitespace. */
  private normalise(query: string): string {
    return query
      .toLowerCase()
      .replace(/[’']/g, '')
      .replace(/[^a-z0-9%+\s-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private tokens(text: string): string[] {
    return text.split(/[\s-]+/).filter(Boolean);
  }

  private plausibleAge(age: number): boolean {
    return age >= 18 && age <= 80;
  }

  /**
   * Tokens eligible for fuzzy correction.
   *
   * Stop words are excluded: they are frequent, short, and close enough to real
   * dictionary terms to produce confident nonsense — "someone" fuzzy-matches
   * "surgeon" on shared first letter and length. A stop word is never the
   * misspelling of a profession, so it is never worth testing.
   */
  private correctionTokens(text: string): string[] {
    return this.tokens(text).filter((t) => !STOP_WORDS.has(t));
  }

  /** Marks every word of a matched phrase as consumed by the winning facet. */
  private claim(claimed: Set<string>, matched: string): void {
    for (const word of this.tokens(matched)) claimed.add(word);
  }

  private addUnique(list: string[] | undefined, value: string): string[] {
    const next = list ? [...list] : [];
    if (!next.includes(value)) next.push(value);
    return next;
  }
}
