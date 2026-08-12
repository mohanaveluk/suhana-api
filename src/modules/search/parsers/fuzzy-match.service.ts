import { Injectable } from '@nestjs/common';
import Fuse from 'fuse.js';
import { DictionaryEntry } from '../dictionaries';

export interface FuzzyHit {
  canonical: string;
  /** The surface form that matched. */
  matched: string;
  /** 0 = perfect, 1 = worst. Fuse's raw score. */
  score: number;
  /** True when the input differed from the dictionary term (a typo was corrected). */
  corrected: boolean;
}

/**
 * Typo-tolerant dictionary lookup.
 *
 * Members type "Docotr", "Calfornia", "Sofware Developer". An exact-match
 * dictionary would silently drop those facets and push the query into the
 * expensive AI fallback, so every dictionary lookup goes through Fuse.js first.
 *
 * One Fuse index is built per dictionary at construction time and reused — index
 * building is the costly part, searching is cheap.
 */
@Injectable()
export class FuzzyMatchService {
  private readonly indexes = new Map<string, Fuse<FuzzyRecord>>();

  /**
   * Fuse threshold: 0 requires a perfect match, 1 matches anything.
   *
   * 0.4 is needed because bitap counts a transposition as two edits — "docotr"
   * scores ~0.33 against "doctor" and a tighter threshold would reject it. The
   * looseness that buys is then reined in by acceptable(), which additionally
   * demands a shared first character and a similar length.
   */
  private static readonly THRESHOLD = 0.4;

  /** A typo almost never changes the first letter, and rarely changes length much. */
  private static readonly MAX_LENGTH_DELTA = 3;
  /** Below this score the match is strong enough to skip the first-letter check. */
  private static readonly STRONG_SCORE = 0.2;

  /**
   * Short tokens are matched strictly — at 3 characters a 0.3 threshold would
   * make almost any two tokens equivalent (e.g. "ca" vs "co").
   */
  private static readonly MIN_FUZZY_LENGTH = 5;

  /** Builds (once) and returns the index for a named dictionary. */
  private index(name: string, dictionary: DictionaryEntry[]): Fuse<FuzzyRecord> {
    const existing = this.indexes.get(name);
    if (existing) return existing;

    const records: FuzzyRecord[] = [];
    for (const entry of dictionary) {
      // The canonical form is searchable too, lower-cased for comparison.
      const terms = new Set([entry.canonical.toLowerCase(), ...entry.synonyms]);
      for (const term of terms) {
        records.push({ term, canonical: entry.canonical });
      }
    }

    const fuse = new Fuse(records, {
      keys: ['term'],
      threshold: FuzzyMatchService.THRESHOLD,
      includeScore: true,
      ignoreLocation: true,
      minMatchCharLength: 3,
    });

    this.indexes.set(name, fuse);
    return fuse;
  }

  /**
   * Exact-first lookup of a single phrase.
   * Returns null when nothing is close enough to be trusted.
   */
  match(
    phrase: string,
    dictionaryName: string,
    dictionary: DictionaryEntry[],
  ): FuzzyHit | null {
    const needle = phrase?.trim().toLowerCase();
    if (!needle) return null;

    // Exact hits skip Fuse entirely — faster and never mis-ranked.
    for (const entry of dictionary) {
      if (entry.canonical.toLowerCase() === needle || entry.synonyms.includes(needle)) {
        return { canonical: entry.canonical, matched: needle, score: 0, corrected: false };
      }
    }

    // Too short to fuzzy-match safely.
    if (needle.length < FuzzyMatchService.MIN_FUZZY_LENGTH) return null;

    const [best] = this.index(dictionaryName, dictionary).search(needle, { limit: 1 });
    if (!best) return null;
    if (!this.acceptable(needle, best.item.term, best.score ?? 1)) return null;

    return {
      canonical: best.item.canonical,
      matched: best.item.term,
      score: best.score ?? 1,
      corrected: best.item.term !== needle,
    };
  }

  /**
   * Second gate on a fuzzy hit.
   *
   * The 0.4 Fuse threshold is deliberately loose so real typos survive; without
   * this check it would also accept things like "doctor" → "doctorate", which
   * silently turns a profession into an education level. Requiring a shared
   * first character and a comparable length rejects those while keeping genuine
   * misspellings, which overwhelmingly preserve the opening letter.
   */
  private acceptable(input: string, candidate: string, score: number): boolean {
    if (Math.abs(input.length - candidate.length) > FuzzyMatchService.MAX_LENGTH_DELTA) {
      return false;
    }
    if (score <= FuzzyMatchService.STRONG_SCORE) return true;

    // Compare against the candidate's first word — multi-word dictionary terms
    // like "software developer" are matched by their leading token.
    return input[0] === candidate[0];
  }

  /**
   * Scans free text for any dictionary term.
   *
   * Multi-word terms are tested first and longest-first, so "software engineer"
   * wins over "engineer" and "family oriented" is never reduced to two unrelated
   * single-word hits.
   */
  findInText(
    text: string,
    dictionaryName: string,
    dictionary: DictionaryEntry[],
    options: { multi?: boolean } = {},
  ): FuzzyHit[] {
    const haystack = ` ${text.toLowerCase()} `;
    const hits: FuzzyHit[] = [];
    const claimed: Array<[number, number]> = [];

    const candidates = dictionary
      .flatMap((entry) =>
        [entry.canonical.toLowerCase(), ...entry.synonyms].map((term) => ({
          term,
          canonical: entry.canonical,
        })),
      )
      // Longest term first so the most specific phrase claims the span.
      .sort((a, b) => b.term.length - a.term.length);

    for (const { term, canonical } of candidates) {
      if (!options.multi && hits.length) break;
      if (hits.some((h) => h.canonical === canonical)) continue;

      const idx = haystack.indexOf(` ${term} `);
      // Also allow the term to sit against punctuation rather than a space.
      const position = idx !== -1 ? idx : this.findWithBoundary(haystack, term);
      if (position === -1) continue;

      const span: [number, number] = [position, position + term.length];
      // A longer phrase already used these characters — don't double-count.
      if (claimed.some(([s, e]) => position < e && span[1] > s)) continue;

      claimed.push(span);
      hits.push({ canonical, matched: term, score: 0, corrected: false });
    }

    return hits;
  }

  /**
   * Fuzzy-corrects individual tokens against a dictionary. Used for the
   * residual tokens that exact scanning did not claim, which is where typos live.
   */
  correctTokens(
    tokens: string[],
    dictionaryName: string,
    dictionary: DictionaryEntry[],
    claimed: ReadonlySet<string> = new Set(),
  ): FuzzyHit[] {
    const hits: FuzzyHit[] = [];
    for (const token of tokens) {
      if (token.length < FuzzyMatchService.MIN_FUZZY_LENGTH) continue;
      // Already consumed by another facet — re-matching it elsewhere is how
      // "doctor" ends up misread as the education level "Doctorate".
      if (claimed.has(token)) continue;

      const hit = this.match(token, dictionaryName, dictionary);
      // Only interested in corrections here; exact hits were already claimed
      // by findInText during the scanning phase.
      if (hit?.corrected && !hits.some((h) => h.canonical === hit.canonical)) {
        hits.push({ ...hit, matched: token });
      }
    }
    return hits;
  }

  /** Finds a term flanked by non-alphanumeric characters (handles trailing punctuation). */
  private findWithBoundary(haystack: string, term: string): number {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = new RegExp(`(?<![a-z0-9])${escaped}(?![a-z0-9])`).exec(haystack);
    return match ? match.index : -1;
  }
}

interface FuzzyRecord {
  term: string;
  canonical: string;
}
