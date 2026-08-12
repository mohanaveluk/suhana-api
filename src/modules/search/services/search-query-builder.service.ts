import { Injectable } from '@nestjs/common';
import { Brackets, Repository, SelectQueryBuilder } from 'typeorm';

import { Profile } from '../../user/entity';
import { SearchIntent } from '../models/search-intent.model';
import { SynonymService } from '../parsers/synonym.service';
import { MaritalStatus } from '../../user/enums/marital-status.enum';

/** Every status meaning "has been married before" — the remarriage search set. */
const PREVIOUSLY_MARRIED_STATUSES: string[] = [
  MaritalStatus.AWAITING_DIVORCE,
  MaritalStatus.DIVORCED,
  MaritalStatus.WIDOWED,
  MaritalStatus.ANNULLED,
];

/**
 * Turns a SearchIntent into a TypeORM query.
 *
 * Two rules govern everything here:
 *
 * 1. **Synonym expansion on read.** Profiles store free text — one member's
 *    occupationTitle is "Physician", another's is "MBBS". A search for "Doctor"
 *    must find both, so each canonical value is expanded to all of its known
 *    aliases and matched with an OR of LIKEs.
 *
 * 2. **Soft facets never exclude.** Personality traits, interests and horoscope
 *    are ranking signals, not filters. Requiring them in SQL would empty most
 *    result sets, because those fields are sparsely populated. Hard facts
 *    (profession, location, religion, age) filter; everything else scores.
 */
@Injectable()
export class SearchQueryBuilderService {
  constructor(private readonly synonyms: SynonymService) {}

  /**
   * Builds the filtered, joined query. Pagination and ordering are applied by
   * the caller so it can also use this builder for counting.
   */
  build(
    profileRepo: Repository<Profile>,
    intent: SearchIntent,
    options: { excludeUserId?: string; shortlistedUserIds?: string[] } = {},
  ): SelectQueryBuilder<Profile> {
    const qb = profileRepo
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.photos', 'photos')
      .leftJoinAndSelect('p.user', 'u')
      // Baseline visibility: only active, searchable profiles of live accounts.
      .where('p.status = :activeStatus', { activeStatus: 'active' })
      .andWhere('p.is_searchable = :searchable', { searchable: 1 })
      .andWhere('u.is_active = :userActive', { userActive: 1 })
      .andWhere('u.is_deleted = :deleted', { deleted: false });

    if (options.excludeUserId) {
      qb.andWhere('u.id != :selfId', { selfId: options.excludeUserId });
    }

    this.applyProfession(qb, intent);
    this.applyEducation(qb, intent);
    this.applyLocation(qb, intent);
    this.applyReligionAndCaste(qb, intent);
    this.applyLanguages(qb, intent);
    this.applyHobbies(qb, intent);
    this.applyMaritalStatus(qb, intent);
    this.applyAge(qb, intent);
    this.applyGender(qb, intent);
    this.applyFamily(qb, intent);
    this.applyRelocation(qb, intent);
    this.applyAccountFilters(qb, intent);
    this.applyKeywords(qb, intent);

    if (intent.similarToShortlisted && options.shortlistedUserIds?.length) {
      qb.andWhere('u.id IN (:...shortlistedIds)', {
        shortlistedIds: options.shortlistedUserIds,
      });
    }

    return qb;
  }

  // ─── Alias matching ────────────────────────────────────────────────────────

  /**
   * Minimum alias length that is safe to match as a bare substring.
   *
   * Abbreviations shorter than this — "ca", "ms", "ba", "md", "be" — appear
   * inside ordinary words, and `LIKE '%ma%'` for Masters happily matches
   * "Diploma" while `LIKE '%ca%'` for Chartered Accountant matches
   * "Cardiologist", "Educator" and "Advocate". Short aliases are therefore
   * matched on word boundaries instead.
   */
  private static readonly MIN_SUBSTRING_ALIAS_LENGTH = 4;

  /**
   * OR-matches a set of aliases against one or more columns.
   *
   * Long aliases use `LIKE %alias%` so "software engineer" still finds
   * "Senior Software Engineer II". Short ones use a word-boundary REGEXP, which
   * matches "MS" in "MS Computer Science" but never inside "Diploma".
   * (MySQL 8 uses ICU regular expressions, so `\b` is supported.)
   */
  private matchAliases(
    w: any,
    columns: string[],
    aliases: string[],
    keyPrefix: string,
  ): void {
    const long = aliases.filter((a) => a.length >= SearchQueryBuilderService.MIN_SUBSTRING_ALIAS_LENGTH);
    const short = aliases.filter((a) => a.length < SearchQueryBuilderService.MIN_SUBSTRING_ALIAS_LENGTH);

    long.forEach((alias, i) => {
      const key = `${keyPrefix}L${i}`;
      for (const column of columns) {
        w.orWhere(`${column} LIKE :${key}`, { [key]: `%${alias}%` });
      }
    });

    if (short.length) {
      const key = `${keyPrefix}S`;
      // Aliases are alphanumeric plus spaces, so no regex escaping is needed;
      // escape defensively anyway in case a dictionary entry gains punctuation.
      const pattern = `\\b(${short
        .map((a) => a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
        .join('|')})\\b`;

      for (const column of columns) {
        w.orWhere(`${column} REGEXP :${key}`, { [key]: pattern });
      }
    }
  }

  // ─── Hard filters ──────────────────────────────────────────────────────────

  private applyProfession(qb: SelectQueryBuilder<Profile>, intent: SearchIntent): void {
    if (!intent.profession) return;

    const aliases = this.synonyms.expand('profession', intent.profession);
    qb.andWhere(
      new Brackets((w) => {
        // Both occupationTitle and educationField are checked: "Doctor" often
        // lives in one or the other depending on how the member filled the form.
        this.matchAliases(w, ['p.occupationTitle', 'p.educationField'], aliases, 'prof');
      }),
    );
  }

  private applyEducation(qb: SelectQueryBuilder<Profile>, intent: SearchIntent): void {
    if (!intent.education) return;

    // "Masters" from a "highly educated" query should also match a Doctorate —
    // a stricter reading would exclude the best-qualified candidates.
    const ladder = ['High School', 'Diploma', 'Bachelors', 'Professional Degree', 'Masters', 'Doctorate'];
    const from = ladder.indexOf(intent.education);
    const acceptable = from === -1 ? [intent.education] : ladder.slice(from);

    const aliases = acceptable.flatMap((level) => this.synonyms.expand('education', level));

    qb.andWhere(
      new Brackets((w) => {
        // educationField is included so "MBA" recorded as a field of study still
        // satisfies a Masters-level search.
        this.matchAliases(w, ['p.educationLevel', 'p.educationField'], aliases, 'edu');
      }),
    );
  }

  private applyLocation(qb: SelectQueryBuilder<Profile>, intent: SearchIntent): void {
    // City and state are OR'd rather than AND'd: a member in Austin should still
    // surface for "doctors in Dallas, Texas" — the state is the real constraint
    // and demanding both would return almost nothing.
    if (intent.city && intent.state) {
      qb.andWhere(
        new Brackets((w) => {
          w.where('p.city LIKE :city', { city: `%${intent.city}%` })
            .orWhere('p.state LIKE :state', { state: `%${intent.state}%` });
        }),
      );
    } else if (intent.city) {
      qb.andWhere('p.city LIKE :city', { city: `%${intent.city}%` });
    } else if (intent.state) {
      qb.andWhere('p.state LIKE :state', { state: `%${intent.state}%` });
    }

    if (intent.country) {
      const aliases = this.synonyms.expand('country', intent.country);
      qb.andWhere(
        new Brackets((w) => {
          // "US", "UK" and "UAE" are all short enough to need boundary matching —
          // otherwise "US" matches "Australia".
          this.matchAliases(w, ['p.country'], aliases, 'ctry');
        }),
      );
    }
  }

  private applyReligionAndCaste(qb: SelectQueryBuilder<Profile>, intent: SearchIntent): void {
    if (intent.religion) {
      qb.andWhere('p.religion LIKE :religion', { religion: `%${intent.religion}%` });
    }
    if (intent.caste) {
      qb.andWhere('p.caste LIKE :caste', { caste: `%${intent.caste}%` });
    }
  }

  private applyLanguages(qb: SelectQueryBuilder<Profile>, intent: SearchIntent): void {
    if (!intent.languages?.length) return;

    qb.andWhere(
      new Brackets((w) => {
        intent.languages!.forEach((language, i) => {
          const aliases = this.synonyms.expand('language', language);
          this.matchAliases(w, ['p.motherTongue'], aliases, `lang${i}_`);
        });
      }),
    );
  }

  /**
   * Columns a hobby can plausibly appear in.
   *
   * Members record the same interest in whichever field the form put in front
   * of them, so "loves music" might live in `interests`, be phrased as a habit
   * in `lifestyleHabits`, be listed as something they want in a partner, or be
   * buried in `aboutMe`. Searching only `interests` misses most of them.
   */
  private static readonly INTEREST_COLUMNS = [
    'p.interests',
    'p.lifestyleHabits',
    'p.partnerExpectations',
    'p.aboutMe',
  ];

  /**
   * interests widen the match; they do not narrow it.
   *
   * A hard filter here is actively harmful: `interests` is optional and thinly
   * populated, so "find a doctor who loves music" would AND away almost every
   * doctor and return nothing. Instead the hobby only becomes a filter when it
   * is the *whole* query ("show people who love travel") — where returning
   * hobby matches is the entire point and there is nothing else to narrow by.
   *
   * In every other case interests are handled by MatchRankingService, which sorts
   * music-loving doctors to the top while still showing the rest.
   */
  private applyHobbies(qb: SelectQueryBuilder<Profile>, intent: SearchIntent): void {
    if (!intent.interests?.length) return;
    if (!this.hobbiesAreThePrimaryIntent(intent)) return;

    qb.andWhere(
      new Brackets((w) => {
        intent.interests!.forEach((hobby, i) => {
          const aliases = this.synonyms.expand('hobby', hobby);
          this.matchAliases(w, SearchQueryBuilderService.INTEREST_COLUMNS, aliases, `hob${i}_`);
        });
      }),
    );
  }

  /** True when the query names a hobby and essentially nothing else to filter on. */
  private hobbiesAreThePrimaryIntent(intent: SearchIntent): boolean {
    return !(
      intent.profession || intent.education || intent.city || intent.state ||
      intent.religion || intent.caste || intent.languages?.length ||
      intent.maritalStatus || intent.familyType ||
      intent.ageMin !== undefined || intent.ageMax !== undefined
    );
  }

  /**
   * Marital status.
   *
   * "Never Married" additionally admits rows where the column is NULL: the
   * field was added after these profiles were created, and in matrimony an
   * unstated status overwhelmingly means never married. The reverse tolerance
   * would be wrong — a search for "divorced" must never surface profiles whose
   * status is simply unknown, so those stay strict.
   */
  private applyMaritalStatus(qb: SelectQueryBuilder<Profile>, intent: SearchIntent): void {
    // "second marriage" / "open to divorcee" — any previously-married status.
    if (intent.openToRemarriage) {
      qb.andWhere('p.marital_status IN (:...remarriageStatuses)', {
        remarriageStatuses: PREVIOUSLY_MARRIED_STATUSES,
      });
      return;
    }

    if (!intent.maritalStatus) return;

    if (intent.maritalStatus === MaritalStatus.NEVER_MARRIED) {
      qb.andWhere(
        new Brackets((w) => {
          w.where('p.marital_status = :marital', { marital: intent.maritalStatus })
            .orWhere('p.marital_status IS NULL');
        }),
      );
      return;
    }

    qb.andWhere('p.marital_status = :marital', { marital: intent.maritalStatus });
  }

  private applyAge(qb: SelectQueryBuilder<Profile>, intent: SearchIntent): void {
    if (intent.ageMin !== undefined) {
      qb.andWhere('p.age >= :ageMin', { ageMin: intent.ageMin });
    }
    if (intent.ageMax !== undefined) {
      qb.andWhere('p.age <= :ageMax', { ageMax: intent.ageMax });
    }
  }

  private applyGender(qb: SelectQueryBuilder<Profile>, intent: SearchIntent): void {
    if (intent.gender) {
      qb.andWhere('p.gender = :gender', { gender: intent.gender });
    }
  }

  private applyFamily(qb: SelectQueryBuilder<Profile>, intent: SearchIntent): void {
    // familyType is a real enum column, so it filters.
    if (intent.familyType) {
      qb.andWhere('p.familyType = :familyType', { familyType: intent.familyType });
    }
    // familyValues is sparse free text — used for ranking only, not filtering,
    // so that "traditional" does not wipe out members who left the field blank.
  }

  private applyRelocation(qb: SelectQueryBuilder<Profile>, intent: SearchIntent): void {
    if (intent.willingToRelocate === true) {
      qb.andWhere('p.willingToRelocate = :relocate', { relocate: true });
    }
  }

  /** Filters that live on the User row rather than the Profile. */
  private applyAccountFilters(qb: SelectQueryBuilder<Profile>, intent: SearchIntent): void {
    if (intent.premiumOnly) {
      qb.andWhere('u.membership IN (:...tiers)', { tiers: ['silver', 'gold', 'platinum'] });
    }
    if (intent.verifiedOnly) {
      qb.andWhere('u.is_verified = :verified', { verified: true });
    }
    if (intent.activeWithinDays) {
      const since = new Date(Date.now() - intent.activeWithinDays * 24 * 60 * 60 * 1000);
      qb.andWhere('u.last_active >= :activeSince', { activeSince: since });
    }
  }

  /**
   * Residual keywords widen the net against free text. OR'd among themselves and
   * applied as a single AND group, so they narrow the result set without
   * requiring every keyword to appear.
   */
  private applyKeywords(qb: SelectQueryBuilder<Profile>, intent: SearchIntent): void {
    const keywords = (intent.keywords ?? []).filter((k) => k.length > 3).slice(0, 5);
    if (!keywords.length) return;

    // Only used when no structured facet was found — otherwise unrecognised
    // words would wrongly shrink an already well-understood query.
    const hasStructuredFacet = Boolean(
      intent.profession || intent.education || intent.city || intent.state ||
      intent.religion || intent.languages?.length || intent.gender,
    );
    if (hasStructuredFacet) return;

    qb.andWhere(
      new Brackets((w) => {
        keywords.forEach((keyword, i) => {
          const key = `kw${i}`;
          w.orWhere(`p.aboutMe LIKE :${key}`, { [key]: `%${keyword}%` })
            .orWhere(`p.occupationTitle LIKE :${key}`, { [key]: `%${keyword}%` })
            .orWhere(`p.educationField LIKE :${key}`, { [key]: `%${keyword}%` })
            .orWhere(`p.interests LIKE :${key}`, { [key]: `%${keyword}%` })
            .orWhere(`p.city LIKE :${key}`, { [key]: `%${keyword}%` });
        });
      }),
    );
  }
}
