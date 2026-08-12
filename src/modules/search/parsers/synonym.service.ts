import { Injectable } from '@nestjs/common';
import {
  DictionaryEntry,
  CITY_DICTIONARY, COUNTRY_DICTIONARY, EDUCATION_DICTIONARY,
  FAMILY_TYPE_DICTIONARY, FAMILY_VALUES_DICTIONARY, GENDER_DICTIONARY,
  HOBBY_DICTIONARY, LANGUAGE_DICTIONARY, MARITAL_STATUS_DICTIONARY,
  PERSONALITY_DICTIONARY, PROFESSION_DICTIONARY, RELIGION_DICTIONARY,
  STATE_DICTIONARY,
} from '../dictionaries';

export type DictionaryName =
  | 'profession' | 'education' | 'religion' | 'language' | 'personality'
  | 'familyType' | 'familyValues' | 'maritalStatus' | 'gender'
  | 'state' | 'city' | 'country' | 'hobby';

/**
 * Maps any surface form to its canonical value.
 *
 * Everything downstream — query builder, ranking, analytics — works only in
 * canonical values, so "physician", "Doctor" and "MBBS" all aggregate as one
 * profession rather than fragmenting the popular-searches report.
 *
 * Lookup is O(1) via a prebuilt reverse index; the dictionaries are static, so
 * the index is built once at construction.
 */
@Injectable()
export class SynonymService {
  private readonly dictionaries: Record<DictionaryName, DictionaryEntry[]> = {
    profession: PROFESSION_DICTIONARY,
    education: EDUCATION_DICTIONARY,
    religion: RELIGION_DICTIONARY,
    language: LANGUAGE_DICTIONARY,
    personality: PERSONALITY_DICTIONARY,
    familyType: FAMILY_TYPE_DICTIONARY,
    familyValues: FAMILY_VALUES_DICTIONARY,
    maritalStatus: MARITAL_STATUS_DICTIONARY,
    gender: GENDER_DICTIONARY,
    state: STATE_DICTIONARY,
    city: CITY_DICTIONARY,
    country: COUNTRY_DICTIONARY,
    hobby: HOBBY_DICTIONARY,
  };

  /** dictionary name → (surface form → canonical) */
  private readonly reverse = new Map<DictionaryName, Map<string, string>>();

  constructor() {
    for (const [name, entries] of Object.entries(this.dictionaries)) {
      const index = new Map<string, string>();
      for (const entry of entries) {
        index.set(entry.canonical.toLowerCase(), entry.canonical);
        for (const synonym of entry.synonyms) {
          index.set(synonym.toLowerCase(), entry.canonical);
        }
      }
      this.reverse.set(name as DictionaryName, index);
    }
  }

  get(name: DictionaryName): DictionaryEntry[] {
    return this.dictionaries[name];
  }

  /** Canonical value for a surface form, or null when unknown. */
  canonicalise(name: DictionaryName, term: string): string | null {
    if (!term) return null;
    return this.reverse.get(name)?.get(term.trim().toLowerCase()) ?? null;
  }

  /**
   * Canonicalises a value that may already be canonical, falling back to the
   * input unchanged. Used on AI-fallback output, which is close to canonical but
   * not guaranteed to be exact.
   */
  canonicaliseOrKeep(name: DictionaryName, term: string): string {
    return this.canonicalise(name, term) ?? term;
  }

  /**
   * All surface forms for a canonical value, including itself.
   *
   * Used by the query builder to widen a match: a profile whose
   * occupationTitle reads "Physician" must still be found by a search for
   * "Doctor", so the WHERE clause tests every known alias.
   */
  expand(name: DictionaryName, canonical: string): string[] {
    const entry = this.dictionaries[name]?.find(
      (e) => e.canonical.toLowerCase() === canonical?.toLowerCase(),
    );
    if (!entry) return canonical ? [canonical] : [];
    return [entry.canonical, ...entry.synonyms];
  }
}
