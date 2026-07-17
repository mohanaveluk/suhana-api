import { Profile } from 'src/modules/user/entity';
import Anthropic from '@anthropic-ai/sdk';
import { Badge } from './matches.model';
import { COMPANY_TIER, EDUCATION_TIER, FAMILY_TYPE_COMPATIBILITY, FAMILY_VALUES_COMPATIBILITY, FIELD_AFFINITY, INSTITUTION_TIER, METRO_CITIES, OCCUPATION_CATEGORY, OCCUPATION_COMPATIBILITY } from 'src/modules/matches/matches-lookup';
import { title } from 'process';

const anthropic = new Anthropic();

/**
 * Calculate age gap compatibility score
 * @param a - User profile A
 * @param b - User profile B (candidate)
 * @returns Compatibility score based on age gap
 */
export function scoreAgeGap(a: Profile, b: Profile): number {
    const gap = Math.abs(a.age - b.age);
    if (gap <= 2) return 95;
    if (gap <= 5) return 80;
    if (gap <= 8) return 65;
    return 45;
}

export function scoreMotherTongue(a: Profile, b: Profile): number {
    return a.motherTongue === b.motherTongue ? 95 : 60;
}

export function scoreIncome(a: Profile, b: Profile): number {
    //convert a.annualIncome and b.annualIncome to numbers if they are strings, assuming they are in formats like "50k", "1M", etc.
    const parseIncome = (income: string | number | undefined) => {
        if (typeof income === 'number') return income;
        if (typeof income === 'string') {
            const lower = income.toLowerCase().trim();
            if (lower.endsWith('k')) return parseFloat(lower.slice(0, -1)) * 1000;
            if (lower.endsWith('m')) return parseFloat(lower.slice(0, -1)) * 1000000;
            return parseFloat(lower);
        }
    };

    const diff = Math.abs(parseIncome(a.annualIncome) - parseIncome(b.annualIncome));
    if (diff <= 10000) return 90;
    if (diff <= 50000) return 75;
    if (diff <= 100000) return 60;
    return 40;
}

function getEducationTier(level: string): number {
  const key = level?.toLowerCase().trim() ?? '';
  // exact match first, then partial match for values like "Bachelor's Degree"
  return EDUCATION_TIER[key]
    ?? Object.entries(EDUCATION_TIER).find(([k]) => key.includes(k))?.[1]
    ?? 2; // default to diploma tier if unknown
}

function scoreEducation(a: Profile, b: Profile): number {
  if (!a.educationLevel || !b.educationLevel) return 65; // missing data fallback

  const tierA = getEducationTier(a.educationLevel);
  const tierB = getEducationTier(b.educationLevel);
  const gap = Math.abs(tierA - tierB);

  // Gap-based scoring — same tier is best, 1 tier apart is still good
  switch (gap) {
    case 0: return 95; // Master + Master, Bachelor + Bachelor
    case 1: return 80; // Master + Bachelor — acceptable
    case 2: return 62; // Master + Diploma — noticeable gap
    case 3: return 45; // PhD + High School — significant mismatch
    default: return 30;
  }
}


function normalise(val: string): string {
  return val?.toLowerCase().trim() ?? '';
}

function scoreLocation(a: Profile, b: Profile): number {
  if (!a.city || !b.city) return 60; // missing data fallback

  const cityA  = normalise(a.city);
  const cityB  = normalise(b.city);
  const stateA = normalise(a.state);
  const stateB = normalise(b.state);

  // Same city — best match
  if (cityA === cityB) return 95;

  // Different city, same state
  if (stateA && stateB && stateA === stateB) return 78;

  // Both in metro cities — more likely to relocate / compatible lifestyle
  if (METRO_CITIES.has(cityA) && METRO_CITIES.has(cityB)) return 65;

  // One metro, one non-metro — lifestyle gap likely
  if (METRO_CITIES.has(cityA) || METRO_CITIES.has(cityB)) return 52;

  // Both non-metro, different states
  return 40;
}

function scoreFamilyValues(a: Profile, b: Profile): number {
  let score = 0;
  let factorsUsed = 0;

  // 1. Family type — nuclear vs joint vs extended
  if (a.familyType && b.familyType) {
    const typeA = normalise(a.familyType);
    const typeB = normalise(b.familyType);
    const typeScore = FAMILY_TYPE_COMPATIBILITY[typeA]?.[typeB] ?? 60;
    score += typeScore;
    factorsUsed++;
  }

  // 2. Family values — traditional vs moderate vs liberal
  if (a.familyValues && b.familyValues) {
    const valA = normalise(a.familyValues);
    const valB = normalise(b.familyValues);
    const valScore = FAMILY_VALUES_COMPATIBILITY[valA]?.[valB] ?? 60;
    score += valScore;
    factorsUsed++;
  }

  // 3. Siblings count — large gap may indicate different upbringing expectations
  if (a.siblings !== undefined && b.siblings !== undefined) {
    const gap = Math.abs(a.siblings - b.siblings);
    const sibScore = gap === 0 ? 90 : gap === 1 ? 82 : gap === 2 ? 70 : 58;
    score += sibScore;
    factorsUsed++;
  }

  // 4. Willingness to relocate — critical for location mismatches
  if (a.willingToRelocate !== undefined && b.willingToRelocate !== undefined) {
    const relocScore = a.willingToRelocate && b.willingToRelocate ? 90  // both flexible
                     : a.willingToRelocate || b.willingToRelocate ? 72  // one flexible
                     : 50;                                               // neither flexible
    score += relocScore;
    factorsUsed++;
  }

  return factorsUsed > 0 ? Math.round(score / factorsUsed) : 65;
}

export function  getInstitutionTier(institution: string): number {
  if (!institution) return 2;
  const key = institution.toLowerCase().trim();
  // partial match — 'symbiosis institute of...' still matches 'symbiosis'
  const match = Object.entries(INSTITUTION_TIER).find(([k]) => key.includes(k));
  return match ? match[1] : 2;
}

export function  parseIncomeLPA(income: string): number {
  if (!income) return 0;
  // handles "18 LPA", "18LPA", "18 lpa", "18.5 LPA"
  const match = income.replace(/,/g, '').match(/[\d.]+/);
  return match ? parseFloat(match[0]) : 0;
}

export function  getOccupationCategory(title: string): string {
  if (!title) return 'other';
  const key = title.toLowerCase().trim();
  const match = Object.entries(OCCUPATION_CATEGORY).find(([k]) => key.includes(k));
  return match ? match[1] : 'other';
}

export function  getCompanyTier(company: string): number {
  if (!company) return 2;
  const key = company.toLowerCase().trim();
  const match = Object.entries(COMPANY_TIER).find(([k]) => key.includes(k));
  return match ? match[1] : 2;
}

export function scoreCareer(a: Profile, b: Profile): number {
  let score = 0;
  let factorsUsed = 0;

  // 1. Education level — tier gap matters
  if (a.educationLevel && b.educationLevel) {
    const tierA = getEducationTier(a.educationLevel);
    const tierB = getEducationTier(b.educationLevel);
    const gap = Math.abs(tierA - tierB);
    const eduScore = gap === 0 ? 95 : gap === 1 ? 80 : gap === 2 ? 60 : 40;
    score += eduScore;
    factorsUsed++;
  }

  // 2. Education field affinity
  if (a.educationField && b.educationField) {
    const fieldA = a.educationField.toLowerCase();
    const fieldB = b.educationField.toLowerCase();
    const affinityList = FIELD_AFFINITY[fieldA] ?? [];
    const isAffine = fieldA === fieldB || affinityList.some(f => fieldB.includes(f));
    score += isAffine ? 88 : 60;
    factorsUsed++;
  }

  // 3. Institution tier — both high tier = bonus
  if (a.institution && b.institution) {
    const tierA = getInstitutionTier(a.institution);
    const tierB = getInstitutionTier(b.institution);
    const avg = (tierA + tierB) / 2;
    const gap = Math.abs(tierA - tierB);
    const instScore = avg >= 4 && gap <= 1 ? 90
                    : avg >= 3            ? 75
                    : gap <= 1            ? 70
                    :                       55;
    score += instScore;
    factorsUsed++;
  }

  // 4. Occupation category compatibility
  if (a.occupationTitle && b.occupationTitle) {
    const catA = getOccupationCategory(a.occupationTitle);
    const catB = getOccupationCategory(b.occupationTitle);
    const compatible = OCCUPATION_COMPATIBILITY[catA]?.includes(catB) ?? false;
    score += compatible ? 85 : 60;
    factorsUsed++;
  }

  // 5. Company tier — signals ambition level alignment
  if (a.company && b.company) {
    const tierA = getCompanyTier(a.company);
    const tierB = getCompanyTier(b.company);
    const gap = Math.abs(tierA - tierB);
    score += gap === 0 ? 90 : gap === 1 ? 78 : gap === 2 ? 65 : 50;
    factorsUsed++;
  }

  // 6. Income range — gap within 1.5x is acceptable
  if (a.annualIncome && b.annualIncome) {
    const incA = parseIncomeLPA(a.annualIncome);
    const incB = parseIncomeLPA(b.annualIncome);
    if (incA > 0 && incB > 0) {
      const ratio = Math.max(incA, incB) / Math.min(incA, incB);
      const incScore = ratio <= 1.3 ? 92
                     : ratio <= 1.5 ? 82
                     : ratio <= 2.0 ? 68
                     : ratio <= 3.0 ? 52
                     :                38;
      score += incScore;
      factorsUsed++;
    }
  }

  // 7. Working status
  if (a.workingStatus && b.workingStatus) {
    const both = [a.workingStatus.toLowerCase(), b.workingStatus.toLowerCase()];
    const bothEmployed = both.every(s => ['employed', 'business', 'self employed'].includes(s));
    score += bothEmployed ? 88 : 62;
    factorsUsed++;
  }

  // Skip familyPreferenceNote — free text, no reliable rule engine scoring

  return factorsUsed > 0 ? Math.round(score / factorsUsed) : 65;
}

// Main function to compute compatibility score and breakdown for two profiles
export function computeCompatibilityRules(a: Profile, b: Profile) {
    const breakdown = {
        education: scoreEducation(a, b),
        location: scoreLocation(a, b),
        familyValues: scoreFamilyValues(a, b),
        religion: a.religion === b.religion ? 90 : 55,
        motherTongue: a.motherTongue === b.motherTongue ? 92 : 62,
        ageGap: scoreAgeGap(a, b),
        income: scoreIncome(a, b),
        career: scoreCareer(a, b),
    };

    const weights = {
        religion: 0.20, familyValues: 0.20, education: 0.15, career:       0.25,
        motherTongue: 0.15, location: 0.10, ageGap: 0.10, income: 0.10,
    };

    // Normalise by the actual sum of the weights used. These weights sum to 1.25
    // (not 1.0), so a plain weighted sum could exceed 100%. Dividing by the weight
    // sum turns this into a true weighted average — guaranteed to stay within the
    // 0–100 range of the individual sub-scores while preserving their relative pull.
    const entries = Object.entries(breakdown);
    const getWeight = (k: string) => weights[k as keyof typeof weights] ?? 0.1;
    const weightSum = entries.reduce((sum, [k]) => sum + getWeight(k), 0);
    const weighted = entries.reduce((sum, [k, v]) => sum + v * getWeight(k), 0);

    // Math.min/max is a defensive cap so the score can never render above 100%.
    const total = Math.min(100, Math.max(0, Math.round(weighted / weightSum)));

    return { total, breakdown };
}

export function generateBadges(breakdown: Record<string, number>) {
    const badges: { label: string; icon: string; score: number }[] = [];
    if (breakdown.familyValues >= 80) badges.push({ label: 'Family Aligned', icon: 'family_restroom', score: breakdown.familyValues });
    if (breakdown.education >= 80) badges.push({ label: 'Edu Match', icon: 'school', score: breakdown.education });
    if (breakdown.location >= 80) badges.push({ label: 'Nearby', icon: 'location_on', score: breakdown.location });
    if (breakdown.emotional >= 85) badges.push({ label: 'Soul Connect', icon: 'psychology', score: breakdown.emotional });
    if (breakdown.lifestyle >= 85) badges.push({ label: 'Lifestyle Sync', icon: 'spa', score: breakdown.lifestyle });
    return badges;
}


//api calls this function to calculate the overall match score based on various factors


