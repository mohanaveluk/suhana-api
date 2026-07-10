import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Anthropic from '@anthropic-ai/sdk';

import { Profile } from '../../user/entity/profile.entity';
import { User } from '../../user/entity/user.entity';
import { computeCompatibilityRules, generateBadges } from '../../../shared/matches/matches.helper';
import {
  ChatProfileSearchCriteria,
  ProfileSearchIntent,
  ProfileSearchSummary,
} from '../interfaces/profile-search.interface';

const INTENT_MODEL = 'claude-haiku-4-5';
const TOP_RESULTS = 6;
// Pull a wider candidate pool than we return, score each against the
// requester's own profile, and keep only the top scorers — the same
// rule-based engine MatchesService uses for its daily match suggestions.
const CANDIDATE_POOL_SIZE = 15;
// computeCompatibilityRules' weights sum to 1.25 (not 1.0), so its raw
// "total" can exceed 100. Normalize by that sum to get a true 0-100 score.
const COMPATIBILITY_WEIGHT_SUM = 1.25;

// Cheap keyword gate — only pay for the AI intent-extraction call when the
// message plausibly asks for matching/searching profiles.
const TRIGGER_KEYWORDS = [
  'match', 'matches', 'matching', 'profile', 'profiles', 'suitable', 'looking for',
  'search', 'find me', 'find a', 'find suitable', 'show me', 'groom', 'grooms',
  'bride', 'brides', 'caste', 'religion', 'horoscope', 'rashi', 'nakshatra',
  'compatible', 'partner', 'suggest', 'recommend', 'shortlist',
];

@Injectable()
export class ProfileSearchService {
  private readonly logger = new Logger(ProfileSearchService.name);

  constructor(
    @InjectRepository(Profile) private readonly profileRepo: Repository<Profile>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    private readonly anthropic: Anthropic,
  ) {}

  looksLikeProfileSearch(message: string): boolean {
    const lower = message.toLowerCase();
    return TRIGGER_KEYWORDS.some((k) => lower.includes(k));
  }

  async extractIntent(message: string): Promise<ProfileSearchIntent> {
    const prompt = `You are an intent-and-entity extractor for a matrimony app's chat assistant.
Given the user's message, decide if they are asking to find/search/match matrimony profiles
(e.g. "find matching profiles for me", "search for Iyer caste profiles", "show grooms in Chennai",
"any matches with Rohini nakshatra?"). General questions about how the app works are NOT a profile search.

Extract any of these optional filters mentioned in the message:
- ageMin, ageMax (numbers; a single age like "28" means ageMin=ageMax=28; a phrase like "under 30" means ageMax=30)
- religion (string)
- caste (string)
- motherTongue (string)
- city, state, country (strings)
- educationLevel (string, e.g. "Master's", "Bachelor's")
- occupationTitle (string, e.g. "Doctor", "Engineer")
- height, weight (strings, as mentioned)
- siblings (number)
- horoscope: { rashi, nakshatra, placeOfBirth, manglikStatus }

Return ONLY valid JSON, no markdown, no commentary, matching exactly this shape:
{"isProfileSearch": boolean, "criteria": {"ageMin": number|null, "ageMax": number|null, "religion": string|null, "caste": string|null, "motherTongue": string|null, "city": string|null, "state": string|null, "country": string|null, "educationLevel": string|null, "occupationTitle": string|null, "height": string|null, "weight": string|null, "siblings": number|null, "horoscope": {"rashi": string|null, "nakshatra": string|null, "placeOfBirth": string|null, "manglikStatus": string|null}}}

User message: "${message}"`;

    try {
      const response = await this.anthropic.messages.create({
        model: INTENT_MODEL,
        max_tokens: 400,
        messages: [{ role: 'user', content: prompt }],
      });

      const text = response.content[0]?.type === 'text' ? response.content[0].text : '';
      const cleaned = text.replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
      const parsed = JSON.parse(cleaned);
      return {
        isProfileSearch: !!parsed.isProfileSearch,
        criteria: this.sanitizeCriteria(parsed.criteria ?? {}),
      };
    } catch (error) {
      this.logger.error('Profile search intent extraction failed', error as Error);
      return { isProfileSearch: false, criteria: {} };
    }
  }

  async searchProfiles(
    userId: string,
    criteria: ChatProfileSearchCriteria,
  ): Promise<{ results: ProfileSearchSummary[]; oppositeGender: string }> {
    const user = await this.userRepo.findOne({ where: { id: userId }, relations: ['profile'] });
    if (!user?.profile) throw new NotFoundException('User profile not found');

    const oppositeGender = user.gender === 'bride' ? 'groom' : 'bride';

    const qb = this.profileRepo
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.photos', 'photos')
      .leftJoinAndSelect('p.user', 'u')
      .where('p.gender = :gender', { gender: oppositeGender })
      .andWhere('p.status = :status', { status: 'active' })
      .andWhere('p.is_searchable = :isSearchable', { isSearchable: 1 })
      .andWhere('u.is_email_verified = :isEmailVerified', { isEmailVerified: 1 })
      .andWhere('u.is_active = :isActive', { isActive: 1 })
      .andWhere('u.id != :userId', { userId });

    if (criteria.ageMin) qb.andWhere('p.age >= :ageMin', { ageMin: criteria.ageMin });
    if (criteria.ageMax) qb.andWhere('p.age <= :ageMax', { ageMax: criteria.ageMax });
    if (criteria.religion) qb.andWhere('LOWER(p.religion) = LOWER(:religion)', { religion: criteria.religion });
    if (criteria.caste) qb.andWhere('LOWER(p.caste) LIKE LOWER(:caste)', { caste: `%${criteria.caste}%` });
    if (criteria.motherTongue) {
      qb.andWhere('LOWER(p.motherTongue) = LOWER(:motherTongue)', { motherTongue: criteria.motherTongue });
    }
    if (criteria.city) qb.andWhere('LOWER(p.city) LIKE LOWER(:city)', { city: `%${criteria.city}%` });
    if (criteria.state) qb.andWhere('LOWER(p.state) LIKE LOWER(:state)', { state: `%${criteria.state}%` });
    if (criteria.country) qb.andWhere('LOWER(p.country) LIKE LOWER(:country)', { country: `%${criteria.country}%` });
    if (criteria.educationLevel) {
      qb.andWhere('LOWER(p.educationLevel) LIKE LOWER(:educationLevel)', { educationLevel: `%${criteria.educationLevel}%` });
    }
    if (criteria.occupationTitle) {
      qb.andWhere('LOWER(p.occupationTitle) LIKE LOWER(:occupationTitle)', { occupationTitle: `%${criteria.occupationTitle}%` });
    }
    if (criteria.height) qb.andWhere('p.height = :height', { height: criteria.height });
    if (criteria.weight) qb.andWhere('p.weight = :weight', { weight: criteria.weight });
    if (criteria.siblings !== undefined && criteria.siblings != null) {
      qb.andWhere('p.siblings = :siblings', { siblings: criteria.siblings });
    }

    if (criteria.horoscope?.rashi) {
      qb.andWhere(`LOWER(JSON_UNQUOTE(JSON_EXTRACT(p.horoscope, '$.rashi'))) = LOWER(:rashi)`, {
        rashi: criteria.horoscope.rashi,
      });
    }
    if (criteria.horoscope?.nakshatra) {
      qb.andWhere(`LOWER(JSON_UNQUOTE(JSON_EXTRACT(p.horoscope, '$.nakshatra'))) = LOWER(:nakshatra)`, {
        nakshatra: criteria.horoscope.nakshatra,
      });
    }
    if (criteria.horoscope?.manglikStatus) {
      qb.andWhere(`LOWER(JSON_UNQUOTE(JSON_EXTRACT(p.horoscope, '$.manglikStatus'))) = LOWER(:manglikStatus)`, {
        manglikStatus: criteria.horoscope.manglikStatus,
      });
    }
    if (criteria.horoscope?.placeOfBirth) {
      qb.andWhere(`LOWER(JSON_UNQUOTE(JSON_EXTRACT(p.horoscope, '$.placeOfBirth'))) LIKE LOWER(:placeOfBirth)`, {
        placeOfBirth: `%${criteria.horoscope.placeOfBirth}%`,
      });
    }

    qb.orderBy('p.profileCompleteness', 'DESC').addOrderBy('photos.isPrimary', 'DESC').take(CANDIDATE_POOL_SIZE);

    const candidates = await qb.getMany();

    const scored = candidates
      .map((candidate) => {
        const { total, breakdown } = computeCompatibilityRules(user.profile, candidate);
        const matchPercentage = Math.min(100, Math.max(0, Math.round(total / COMPATIBILITY_WEIGHT_SUM)));
        return { candidate, matchPercentage, breakdown };
      })
      .sort((a, b) => b.matchPercentage - a.matchPercentage)
      .slice(0, TOP_RESULTS);

    return {
      results: scored.map(({ candidate, matchPercentage, breakdown }) => this.toSummary(candidate, matchPercentage, breakdown)),
      oppositeGender,
    };
  }

  buildAnswerText(criteria: ChatProfileSearchCriteria, oppositeGender: string, count: number): string {
    const filters = this.describeCriteria(criteria);
    const genderLabel = oppositeGender === 'groom' ? 'groom' : 'bride';

    if (count === 0) {
      return filters
        ? `I couldn't find any ${genderLabel} profiles matching ${filters}. Try broadening your search.`
        : `I couldn't find any ${genderLabel} profiles right now. Please check back soon.`;
    }

    const plural = count === 1 ? 'profile' : 'profiles';
    return filters
      ? `I found ${count} ${genderLabel} ${plural} matching ${filters}, ranked by compatibility. Here are your best matches:`
      : `I found ${count} ${genderLabel} ${plural} ranked by compatibility with your profile. Here are your best matches:`;
  }

  private describeCriteria(criteria: ChatProfileSearchCriteria): string {
    const parts: string[] = [];
    if (criteria.caste) parts.push(`caste "${criteria.caste}"`);
    if (criteria.religion) parts.push(`religion "${criteria.religion}"`);
    if (criteria.motherTongue) parts.push(`mother tongue "${criteria.motherTongue}"`);
    if (criteria.city) parts.push(`city "${criteria.city}"`);
    if (criteria.state) parts.push(`state "${criteria.state}"`);
    if (criteria.country) parts.push(`country "${criteria.country}"`);
    if (criteria.ageMin || criteria.ageMax) {
      parts.push(`age ${criteria.ageMin ?? '0'}-${criteria.ageMax ?? '100'}`);
    }
    if (criteria.educationLevel) parts.push(`education "${criteria.educationLevel}"`);
    if (criteria.occupationTitle) parts.push(`occupation "${criteria.occupationTitle}"`);
    if (criteria.horoscope?.rashi) parts.push(`rashi "${criteria.horoscope.rashi}"`);
    if (criteria.horoscope?.nakshatra) parts.push(`nakshatra "${criteria.horoscope.nakshatra}"`);
    if (criteria.horoscope?.manglikStatus) parts.push(`manglik status "${criteria.horoscope.manglikStatus}"`);
    return parts.join(', ');
  }

  private sanitizeCriteria(raw: any): ChatProfileSearchCriteria {
    const str = (v: any): string | undefined => {
      if (typeof v !== 'string') return undefined;
      const trimmed = v.trim().slice(0, 100);
      return trimmed.length ? trimmed : undefined;
    };
    const num = (v: any): number | undefined => {
      const n = Number(v);
      return Number.isFinite(n) ? n : undefined;
    };

    const horoscopeRaw = raw?.horoscope ?? {};
    const horoscope = {
      rashi: str(horoscopeRaw.rashi),
      nakshatra: str(horoscopeRaw.nakshatra),
      placeOfBirth: str(horoscopeRaw.placeOfBirth),
      manglikStatus: str(horoscopeRaw.manglikStatus),
    };
    const hasHoroscope = Object.values(horoscope).some((v) => v !== undefined);

    return {
      ageMin: num(raw?.ageMin),
      ageMax: num(raw?.ageMax),
      religion: str(raw?.religion),
      caste: str(raw?.caste),
      motherTongue: str(raw?.motherTongue),
      city: str(raw?.city),
      state: str(raw?.state),
      country: str(raw?.country),
      educationLevel: str(raw?.educationLevel),
      occupationTitle: str(raw?.occupationTitle),
      height: str(raw?.height),
      weight: str(raw?.weight),
      siblings: raw?.siblings !== undefined && raw?.siblings !== null ? num(raw.siblings) : undefined,
      horoscope: hasHoroscope ? horoscope : undefined,
    };
  }

  private toSummary(
    profile: Profile,
    matchPercentage: number,
    compatibilityBreakdown: Record<string, number>,
  ): ProfileSearchSummary {
    return {
      userId: profile.id,
      firstName: profile.firstName,
      lastName: profile.lastName,
      age: profile.age,
      gender: profile.gender,
      religion: profile.religion,
      caste: profile.caste,
      motherTongue: profile.motherTongue,
      height: profile.height,
      location: { city: profile.city, state: profile.state, country: profile.country },
      education: { level: profile.educationLevel, field: profile.educationField },
      occupation: { title: profile.occupationTitle },
      horoscope: profile.horoscope
        ? {
            rashi: profile.horoscope.rashi,
            nakshatra: profile.horoscope.nakshatra,
            manglikStatus: profile.horoscope.manglikStatus,
          }
        : undefined,
      photos: (profile.photos || []).map((ph) => ({ id: ph.id, url: ph.url, isPrimary: ph.isPrimary })),
      matchPercentage,
      compatibilityBreakdown,
      badges: generateBadges(compatibilityBreakdown),
    };
  }
}
