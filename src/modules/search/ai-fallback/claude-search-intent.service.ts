import { Injectable } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';

import { AiIntentProvider } from './ai-intent-provider.interface';
import { SearchIntent } from '../models/search-intent.model';
import { SynonymService } from '../parsers/synonym.service';
import { CustomLoggerService } from '../../logger/custom-logger.service';

/**
 * Claude-backed intent extraction.
 *
 * Uses Haiku rather than Sonnet: this is a short, highly constrained
 * classification task where the cheaper model performs equivalently, and the
 * fallback is meant to be the exception — paying Sonnet prices for it would
 * defeat the purpose of the local parser.
 *
 * Everything the model returns is re-canonicalised through SynonymService before
 * use. The model is good at understanding phrasing and unreliable at reproducing
 * our exact vocabulary, so its output is treated as a hint, not as truth.
 */
@Injectable()
export class ClaudeSearchIntentService implements AiIntentProvider {
  private static readonly MODEL = 'claude-haiku-4-5';
  private static readonly MAX_TOKENS = 400;
  private static readonly TIMEOUT_MS = 8_000;

  constructor(
    private readonly anthropic: Anthropic,
    private readonly synonyms: SynonymService,
    private readonly logger: CustomLoggerService,
  ) {}

  isAvailable(): boolean {
    return Boolean(process.env.CLAUDE_API_KEY);
  }

  async extractIntent(query: string): Promise<Partial<SearchIntent> | null> {
    if (!this.isAvailable()) return null;

    try {
      const response = await this.anthropic.messages.create(
        {
          model: ClaudeSearchIntentService.MODEL,
          max_tokens: ClaudeSearchIntentService.MAX_TOKENS,
          messages: [{ role: 'user', content: this.buildPrompt(query) }],
        },
        { timeout: ClaudeSearchIntentService.TIMEOUT_MS },
      );

      const block = response.content[0];
      const text = block?.type === 'text' ? block.text : '';
      const parsed = this.parseJson(text);
      if (!parsed) return null;

      return this.canonicalise(parsed);
    } catch (error: any) {
      // Never propagate — the caller falls back to the low-confidence local parse.
      this.logger.warn(`AI search intent extraction failed: ${error?.message}`);
      return null;
    }
  }

  private buildPrompt(query: string): string {
    return `Convert this matrimonial search text into JSON.

Return ONLY the JSON object. No prose, no markdown fences, no explanation.

Supported fields (omit any field the text does not clearly imply — never guess):
  profession          string   e.g. "Doctor", "Software Engineer", "Teacher", "Lawyer"
  education           string   one of: "Doctorate","Masters","Bachelors","Professional Degree","Diploma","High School"
  religion            string   e.g. "Hindu", "Muslim", "Christian", "Sikh", "Jain"
  caste               string
  city                string
  state               string
  country             string
  ageMin              number
  ageMax              number
  maritalStatus       string   one of: "Never Married","Awaiting Divorce","Divorced","Widowed","Annulled"
  openToRemarriage    boolean  true for "second marriage" / "open to divorcee" —
                               means any previously-married status, not one specific one
  languages           string[] e.g. ["Tamil","Telugu"]
  personalityTraits   string[] from: caring, kind, family-oriented, traditional, modern, honest,
                               friendly, spiritual, independent, ambitious, career-focused,
                               adventurous, creative, calm, health-conscious, vegetarian, non-smoker
  interests           string[] e.g. ["travel","cooking","music","reading","sports","fitness"]
  familyType          string   one of: "joint","nuclear"
  familyValues        string   one of: "traditional","moderate","liberal"
  willingToRelocate   boolean
  horoscopeRequired   boolean
  gender              string   one of: "bride","groom"
  premiumOnly         boolean
  verifiedOnly        boolean
  activeWithinDays    number
  minMatchScore       number

Rules:
- Preferring family over career means familyValues "traditional" and personalityTraits ["family-oriented"].
- "highly educated" / "well qualified" means education "Masters".
- Mentioning a parent's or family's approval means familyValues "traditional" and horoscopeRequired true.
- "single" and "unmarried" both mean maritalStatus "Never Married".
- Do not invent a location, religion or caste that is not stated.

Input: "${query.replace(/"/g, "'")}"`;
  }

  /** Tolerates fenced or prose-wrapped output by extracting the outermost object. */
  private parseJson(text: string): Record<string, any> | null {
    if (!text) return null;

    const cleaned = text
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim();

    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start === -1 || end <= start) return null;

    try {
      const parsed = JSON.parse(cleaned.slice(start, end + 1));
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch {
      return null;
    }
  }

  /**
   * Maps model output onto our canonical vocabulary and drops anything
   * unrecognised or of the wrong type. Without this, a hallucinated field or a
   * string where a number belongs would reach the query builder.
   */
  private canonicalise(raw: Record<string, any>): Partial<SearchIntent> {
    const intent: Partial<SearchIntent> = {};

    const str = (v: any) => (typeof v === 'string' && v.trim() ? v.trim() : undefined);
    const num = (v: any) => {
      const n = typeof v === 'number' ? v : Number(v);
      return Number.isFinite(n) ? n : undefined;
    };
    const bool = (v: any) => (typeof v === 'boolean' ? v : undefined);
    const arr = (v: any) =>
      Array.isArray(v) ? v.filter((x) => typeof x === 'string' && x.trim()) : [];

    if (str(raw.profession)) {
      intent.profession = this.synonyms.canonicaliseOrKeep('profession', raw.profession);
    }
    if (str(raw.education)) {
      intent.education = this.synonyms.canonicaliseOrKeep('education', raw.education);
    }
    if (str(raw.religion)) {
      intent.religion = this.synonyms.canonicaliseOrKeep('religion', raw.religion);
    }
    if (str(raw.caste)) intent.caste = raw.caste.trim();
    if (str(raw.city)) intent.city = this.synonyms.canonicaliseOrKeep('city', raw.city);
    if (str(raw.state)) intent.state = this.synonyms.canonicaliseOrKeep('state', raw.state);
    if (str(raw.country)) intent.country = this.synonyms.canonicaliseOrKeep('country', raw.country);

    const ageMin = num(raw.ageMin);
    const ageMax = num(raw.ageMax);
    if (ageMin !== undefined && ageMin >= 18 && ageMin <= 80) intent.ageMin = ageMin;
    if (ageMax !== undefined && ageMax >= 18 && ageMax <= 80) intent.ageMax = ageMax;

    if (str(raw.maritalStatus)) {
      intent.maritalStatus = this.synonyms.canonicaliseOrKeep('maritalStatus', raw.maritalStatus);
    }

    const languages = arr(raw.languages)
      .map((l: string) => this.synonyms.canonicalise('language', l))
      .filter((l): l is string => Boolean(l));
    if (languages.length) intent.languages = [...new Set(languages)];

    const traits = arr(raw.personalityTraits)
      .map((t: string) => this.synonyms.canonicalise('personality', t))
      .filter((t): t is string => Boolean(t));
    if (traits.length) intent.personalityTraits = [...new Set(traits)];

    const hobbies = arr(raw.interests)
      .map((h: string) => this.synonyms.canonicalise('hobby', h))
      .filter((h): h is string => Boolean(h));
    if (hobbies.length) intent.interests = [...new Set(hobbies)];

    const familyType = this.synonyms.canonicalise('familyType', str(raw.familyType) ?? '');
    if (familyType) intent.familyType = familyType;

    const familyValues = this.synonyms.canonicalise('familyValues', str(raw.familyValues) ?? '');
    if (familyValues) intent.familyValues = familyValues;

    const gender = this.synonyms.canonicalise('gender', str(raw.gender) ?? '');
    if (gender) intent.gender = gender;

    if (bool(raw.openToRemarriage) !== undefined) intent.openToRemarriage = raw.openToRemarriage;
    if (bool(raw.willingToRelocate) !== undefined) intent.willingToRelocate = raw.willingToRelocate;
    if (bool(raw.horoscopeRequired) !== undefined) intent.horoscopeRequired = raw.horoscopeRequired;
    if (bool(raw.premiumOnly) !== undefined) intent.premiumOnly = raw.premiumOnly;
    if (bool(raw.verifiedOnly) !== undefined) intent.verifiedOnly = raw.verifiedOnly;

    const activeWithinDays = num(raw.activeWithinDays);
    if (activeWithinDays !== undefined && activeWithinDays > 0) {
      intent.activeWithinDays = Math.min(365, Math.round(activeWithinDays));
    }

    const minMatchScore = num(raw.minMatchScore);
    if (minMatchScore !== undefined && minMatchScore > 0 && minMatchScore <= 100) {
      intent.minMatchScore = minMatchScore;
    }

    return intent;
  }
}
