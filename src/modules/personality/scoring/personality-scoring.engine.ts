import {
  ConfidenceLevel,
  DIMENSION_ORDER,
  DIMENSION_POLES,
  PersonalityDimension,
  PersonalityPole,
} from '../enums/personality.enums';

/**
 * Pure, dependency-free scoring for the Aurora Personality Assessment.
 * Kept free of Nest/TypeORM so it is trivially unit-testable and reusable
 * (e.g. by a batch re-scoring job or a future AI analyser).
 */

export type PoleScores = Record<PersonalityPole, number>;

export interface ScoredAnswer {
  dimension: PersonalityDimension;
  scoreDirection: PersonalityPole;
  scoreValue: number;
  // Largest score any option of this question can award — the question's
  // maximum contribution to |first − second| for its dimension.
  maxScoreValue: number;
}

export interface PersonalityScoringResult {
  personalityType: string;
  poleScores: PoleScores;
  confidenceScore: number; // 0–100, two decimals
  confidenceLevel: ConfidenceLevel;
}

export const CONFIDENCE_HIGH_THRESHOLD = 60;
export const CONFIDENCE_MEDIUM_THRESHOLD = 30;

export function emptyPoleScores(): PoleScores {
  return { E: 0, I: 0, S: 0, N: 0, T: 0, F: 0, J: 0, P: 0 };
}

/** First pole wins only on a strict majority: E > I ⇒ E, otherwise I. */
export function dominantPole(
  scores: PoleScores,
  dimension: PersonalityDimension,
): PersonalityPole {
  const [first, second] = DIMENSION_POLES[dimension];
  return scores[first] > scores[second] ? first : second;
}

export function toConfidenceLevel(confidenceScore: number): ConfidenceLevel {
  if (confidenceScore >= CONFIDENCE_HIGH_THRESHOLD) return ConfidenceLevel.HIGH;
  if (confidenceScore >= CONFIDENCE_MEDIUM_THRESHOLD)
    return ConfidenceLevel.MEDIUM;
  return ConfidenceLevel.LOW;
}

/**
 * Share of each pole within its dimension, as whole percentages summing to 100.
 * A dimension with no points (all neutral) reads 50/50.
 */
export function polePercentages(
  scores: PoleScores,
  dimension: PersonalityDimension,
): Record<string, number> {
  const [first, second] = DIMENSION_POLES[dimension];
  const total = scores[first] + scores[second];
  const firstPct = total === 0 ? 50 : Math.round((scores[first] / total) * 100);
  return { [first]: firstPct, [second]: 100 - firstPct };
}

/**
 * Preference strength on a dimension in [-1, 1]: +1 fully toward the first pole
 * (E/S/T/J), -1 fully toward the second, 0 balanced. Used for compatibility.
 */
export function dimensionPosition(
  scores: PoleScores,
  dimension: PersonalityDimension,
): number {
  const [first, second] = DIMENSION_POLES[dimension];
  const total = scores[first] + scores[second];
  return total === 0 ? 0 : (scores[first] - scores[second]) / total;
}

export function personalityTypeFromScores(scores: PoleScores): string {
  return DIMENSION_ORDER.map((dimension) =>
    dominantPole(scores, dimension),
  ).join('');
}

/**
 * Scores a full set of answers.
 *
 *   type        = dominant pole per dimension, combined in E/I-S/N-T/F-J/P order
 *   difference  = |E−I| + |S−N| + |T−F| + |J−P|
 *   confidence  = difference ÷ maximum achievable difference × 100
 *
 * The maximum is derived from the answered questions (Σ maxScoreValue), so
 * confidence stays correct if the question bank grows or shrinks.
 */
export function scoreAssessment(
  answers: ScoredAnswer[],
): PersonalityScoringResult {
  const poleScores = emptyPoleScores();
  let maxDifference = 0;

  for (const answer of answers) {
    if (!DIMENSION_POLES[answer.dimension]?.includes(answer.scoreDirection)) {
      throw new Error(
        `Invalid score mapping: pole ${answer.scoreDirection} does not belong to dimension ${answer.dimension}`,
      );
    }
    poleScores[answer.scoreDirection] += answer.scoreValue;
    maxDifference += answer.maxScoreValue;
  }

  const difference = DIMENSION_ORDER.reduce((sum, dimension) => {
    const [first, second] = DIMENSION_POLES[dimension];
    return sum + Math.abs(poleScores[first] - poleScores[second]);
  }, 0);

  const confidenceScore =
    maxDifference === 0
      ? 0
      : Math.round((difference / maxDifference) * 10000) / 100;

  return {
    personalityType: personalityTypeFromScores(poleScores),
    poleScores,
    confidenceScore,
    confidenceLevel: toConfidenceLevel(confidenceScore),
  };
}
