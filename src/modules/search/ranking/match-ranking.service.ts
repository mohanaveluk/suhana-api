import { Injectable } from '@nestjs/common';

import { Profile } from '../../user/entity';
import { SearchIntent } from '../models/search-intent.model';
import { RANKING_WEIGHTS } from '../enums/search.enums';
import { SynonymService } from '../parsers/synonym.service';

export interface RankedProfile {
  profile: Profile;
  score: number;
  breakdown: Record<string, number>;
  reasons: string[];
}

/**
 * Scores how well each candidate fits the intent, 0-100.
 *
 * The SQL layer decides *whether* a profile can appear; this decides *in what
 * order*. That split matters because the interesting matrimony signals —
 * personality, family values, horoscope — are sparsely filled in. Filtering on
 * them would return nothing; scoring on them surfaces the best fits first while
 * still showing everyone who qualifies on the hard facts.
 *
 * Dimensions with no expressed preference are dropped and the remaining weights
 * are renormalised, so a query naming only a profession is not permanently
 * capped at 25/100.
 */
@Injectable()
export class MatchRankingService {
  constructor(private readonly synonyms: SynonymService) {}

  rank(profiles: Profile[], intent: SearchIntent): RankedProfile[] {
    return profiles
      .map((profile) => this.score(profile, intent))
      .sort((a, b) => b.score - a.score);
  }

  score(profile: Profile, intent: SearchIntent): RankedProfile {
    const breakdown: Record<string, number> = {};
    const reasons: string[] = [];

    // [dimension, expressed?, 0-1 fit]
    const dimensions: Array<[keyof typeof RANKING_WEIGHTS, boolean, number]> = [
      ['profession', Boolean(intent.profession), this.professionFit(profile, intent, reasons)],
      ['location', this.wantsLocation(intent), this.locationFit(profile, intent, reasons)],
      ['education', Boolean(intent.education), this.educationFit(profile, intent, reasons)],
      ['familyValues', this.wantsFamily(intent), this.familyFit(profile, intent, reasons)],
      ['personality', this.wantsPersonality(intent), this.personalityFit(profile, intent, reasons)],
      ['horoscope', Boolean(intent.horoscopeRequired), this.horoscopeFit(profile, reasons)],
    ];

    const expressed = dimensions.filter(([, wanted]) => wanted);

    // Nothing was asked for — rank by profile quality instead of returning
    // an arbitrary order.
    if (!expressed.length) {
      const completeness = Math.min(100, profile.profileCompleteness ?? 0);
      return {
        profile,
        score: Math.round(completeness),
        breakdown: { profileCompleteness: Math.round(completeness) },
        reasons: reasons.length ? reasons : ['Matches your search'],
      };
    }

    const totalWeight = expressed.reduce((sum, [dim]) => sum + RANKING_WEIGHTS[dim], 0);

    let score = 0;
    for (const [dim, , fit] of expressed) {
      // Renormalise so the expressed dimensions always span the full 0-100.
      const contribution = (RANKING_WEIGHTS[dim] / totalWeight) * 100 * fit;
      breakdown[dim] = Math.round(contribution);
      score += contribution;
    }

    // Small tie-breaker so a fuller profile edges out a sparse one at equal fit.
    // Capped at 2 points — it must never outweigh a real dimension.
    const completenessBonus = Math.min(2, (profile.profileCompleteness ?? 0) / 50);
    score = Math.min(100, score + completenessBonus);

    return {
      profile,
      score: Math.round(score),
      breakdown,
      reasons: reasons.length ? reasons : ['Matches your search'],
    };
  }

  // ─── Dimension scorers (each returns 0-1) ──────────────────────────────────

  private professionFit(profile: Profile, intent: SearchIntent, reasons: string[]): number {
    if (!intent.profession) return 0;

    const haystack = `${profile.occupationTitle ?? ''} ${profile.educationField ?? ''} ${profile.company ?? ''}`
      .toLowerCase();
    const aliases = this.synonyms.expand('profession', intent.profession).map((a) => a.toLowerCase());

    // An exact canonical hit is a stronger signal than an alias hit.
    if (haystack.includes(intent.profession.toLowerCase())) {
      reasons.push(`Works as ${intent.profession}`);
      return 1;
    }
    if (aliases.some((alias) => haystack.includes(alias))) {
      reasons.push(`Profession matches ${intent.profession}`);
      return 0.85;
    }
    return 0;
  }

  private locationFit(profile: Profile, intent: SearchIntent, reasons: string[]): number {
    if (!this.wantsLocation(intent)) return 0;

    const city = profile.city?.toLowerCase() ?? '';
    const state = profile.state?.toLowerCase() ?? '';
    const country = profile.country?.toLowerCase() ?? '';

    // Same city is the strongest location signal, then state, then country.
    if (intent.city && city.includes(intent.city.toLowerCase())) {
      reasons.push(`Lives in ${profile.city}`);
      return 1;
    }
    if (intent.state && state.includes(intent.state.toLowerCase())) {
      reasons.push(`Located in ${profile.state}`);
      return 0.8;
    }
    if (intent.country && country.includes(intent.country.toLowerCase())) {
      return 0.5;
    }

    // Willing to relocate partly compensates for being in the wrong place.
    if (profile.willingToRelocate) {
      reasons.push('Willing to relocate');
      return 0.4;
    }
    return 0;
  }

  private educationFit(profile: Profile, intent: SearchIntent, reasons: string[]): number {
    if (!intent.education) return 0;

    const ladder = ['High School', 'Diploma', 'Bachelors', 'Professional Degree', 'Masters', 'Doctorate'];
    const wanted = ladder.indexOf(intent.education);

    const level = profile.educationLevel ?? '';
    const canonical = this.synonyms.canonicalise('education', level) ?? level;
    const actual = ladder.indexOf(canonical);

    if (wanted === -1 || actual === -1) {
      // Unrecognised level — fall back to a substring check rather than 0.
      return level.toLowerCase().includes(intent.education.toLowerCase()) ? 0.8 : 0;
    }

    if (actual === wanted) {
      reasons.push(`Educated to ${canonical} level`);
      return 1;
    }
    if (actual > wanted) {
      reasons.push(`Highly educated (${canonical})`);
      return 1; // exceeding the requirement is a full match, not a penalty
    }
    // Below the bar: partial credit that decays with distance.
    return Math.max(0, 1 - (wanted - actual) * 0.35);
  }

  private familyFit(profile: Profile, intent: SearchIntent, reasons: string[]): number {
    if (!this.wantsFamily(intent)) return 0;

    let hits = 0;
    let checks = 0;

    if (intent.familyType) {
      checks++;
      if (profile.familyType === intent.familyType) {
        hits++;
        reasons.push(`${this.titleCase(intent.familyType)} family`);
      }
    }

    if (intent.familyValues) {
      checks++;
      const values = (profile.familyValues ?? '').toLowerCase();
      if (values.includes(intent.familyValues.toLowerCase())) {
        hits++;
        reasons.push(`${this.titleCase(intent.familyValues)} family values`);
      }
    }

    if (intent.familyApproval) {
      checks++;
      // Parental approval reads as traditional values plus a filled horoscope.
      const traditional = (profile.familyValues ?? '').toLowerCase().includes('traditional');
      const hasHoroscope = Boolean(profile.horoscope?.rashi || profile.horoscope?.nakshatra);
      if (traditional || hasHoroscope) {
        hits++;
        reasons.push('Aligns with traditional family expectations');
      }
    }

    return checks ? hits / checks : 0;
  }

  /**
   * Scores personality traits and hobbies together.
   *
   * They share the 10% weight rather than each getting their own dimension:
   * both are soft, sparsely-filled signals drawn from the same profile fields,
   * and the specified weighting allocates 10% to this kind of signal in total.
   */
  private personalityFit(profile: Profile, intent: SearchIntent, reasons: string[]): number {
    const traits = intent.personalityTraits ?? [];
    const hobbies = intent.interests ?? [];
    if (!traits.length && !hobbies.length) return 0;

    // Traits and interests can be recorded in several places; search all of
    // them. This must stay in step with
    // SearchQueryBuilderService.INTEREST_COLUMNS, or a profile could be
    // filtered in on a hobby and then score zero for it.
    const haystack = [
      ...(profile.partnerExpectations ?? []),
      ...(profile.interests ?? []),
      ...(profile.lifestyleHabits ?? []),
      profile.personalityType ?? '',
      profile.familyValues ?? '',
      profile.aboutMe ?? '',
      profile.familyPreferenceNote ?? '',
    ]
      .join(' ')
      .toLowerCase();

    const hits = (values: string[], dictionary: 'personality' | 'hobby') =>
      values.filter((value) => {
        const aliases = this.synonyms.expand(dictionary, value).map((a) => a.toLowerCase());
        return aliases.some((alias) => haystack.includes(alias));
      });

    const matchedTraits = hits(traits, 'personality');
    const matchedHobbies = hits(hobbies, 'hobby');
    const matched = [...matchedTraits, ...matchedHobbies];

    if (matched.length) {
      reasons.push(...matched.slice(0, 2).map((t) => this.titleCase(t)));
    }
    return matched.length / (traits.length + hobbies.length);
  }

  private horoscopeFit(profile: Profile, reasons: string[]): number {
    const h = profile.horoscope;
    if (!h) return 0;

    // Completeness of the horoscope block is the proxy: real compatibility
    // requires both charts and is computed by the matches module, not here.
    const fields = [h.rashi, h.nakshatra, h.dateOfBirth, h.timeOfBirth, h.placeOfBirth];
    const filled = fields.filter(Boolean).length;
    if (!filled) return 0;

    if (filled >= 4) reasons.push('Complete horoscope available');
    return filled / fields.length;
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  private wantsLocation(intent: SearchIntent): boolean {
    return Boolean(intent.city || intent.state || intent.country);
  }

  private wantsPersonality(intent: SearchIntent): boolean {
    return Boolean(intent.personalityTraits?.length || intent.interests?.length);
  }

  private wantsFamily(intent: SearchIntent): boolean {
    return Boolean(intent.familyType || intent.familyValues || intent.familyApproval);
  }

  private titleCase(value: string): string {
    return value
      .split(/[\s-]+/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }
}
