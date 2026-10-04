import {
  DIMENSION_ORDER,
  DIMENSION_POLES,
  LikertOptionKey,
  PersonalityDimension,
  PersonalityPole,
} from '../enums/personality.enums';

/**
 * Source of truth for the seeded Aurora Personality Assessment — 32 statements,
 * 8 per dimension, each answered on a 5-point Likert scale.
 *
 * Consumed by the seed migration and by unit tests. Once seeded in an
 * environment, change the live bank with a new migration (retire questions via
 * active_flag rather than editing or deleting answered ones).
 */

export interface LikertChoice {
  key: LikertOptionKey;
  text: string;
  // Signed agreement: +2 strongly agree … -2 strongly disagree.
  agreement: number;
}

export const LIKERT_SCALE: readonly LikertChoice[] = [
  { key: LikertOptionKey.STRONGLY_AGREE, text: 'Strongly Agree', agreement: 2 },
  { key: LikertOptionKey.AGREE, text: 'Agree', agreement: 1 },
  { key: LikertOptionKey.NEUTRAL, text: 'Neutral', agreement: 0 },
  { key: LikertOptionKey.DISAGREE, text: 'Disagree', agreement: -1 },
  {
    key: LikertOptionKey.STRONGLY_DISAGREE,
    text: 'Strongly Disagree',
    agreement: -2,
  },
];

export interface PersonalityQuestionSeed {
  id: number;
  code: string;
  text: string;
  dimension: PersonalityDimension;
  // Pole that agreement points toward. All seeded statements are keyed to the
  // first pole (E/S/T/J); a reverse-keyed question would set the second pole.
  keyedPole: PersonalityPole;
  displayOrder: number;
}

export interface PersonalityOptionSeed {
  optionKey: LikertOptionKey;
  optionText: string;
  scoreDirection: PersonalityPole;
  scoreValue: number;
  displayOrder: number;
}

const STATEMENTS: Record<PersonalityDimension, string[]> = {
  [PersonalityDimension.EI]: [
    'I enjoy being the center of attention.',
    'Social gatherings energize me.',
    'I prefer discussing ideas with others.',
    'I make friends quickly.',
    'I enjoy networking events.',
    'I think aloud when solving problems.',
    'I like group activities.',
    'I initiate conversations easily.',
  ],
  [PersonalityDimension.SN]: [
    'I focus on practical facts.',
    'I trust experience more than instinct.',
    'I prefer concrete examples.',
    'I notice small details.',
    'I enjoy step-by-step processes.',
    'I value proven methods.',
    'I focus on present realities.',
    'I prefer realistic plans.',
  ],
  [PersonalityDimension.TF]: [
    'Logic is more important than emotions.',
    'I make objective decisions.',
    'Facts matter more than feelings.',
    'I can provide direct criticism.',
    'I prioritize fairness over compassion.',
    'I analyze before reacting.',
    'I remain calm during conflict.',
    'I separate emotions from decisions.',
  ],
  [PersonalityDimension.JP]: [
    'I prefer detailed plans.',
    'I dislike last-minute changes.',
    'I organize my schedule carefully.',
    'I finish tasks early.',
    'I prefer predictable routines.',
    'I like structured environments.',
    'I make decisions quickly.',
    'I enjoy setting goals.',
  ],
};

/**
 * Questions are interleaved for display (EI, SN, TF, JP, EI, …) so members
 * don't answer eight near-identical statements in a row. IDs are explicit so
 * every environment shares the same question ids.
 */
export const PERSONALITY_QUESTION_BANK: readonly PersonalityQuestionSeed[] =
  DIMENSION_ORDER.flatMap((dimension, dimIndex) =>
    STATEMENTS[dimension].map((text, i) => ({
      id: dimIndex * 8 + i + 1,
      code: `${dimension}_${String(i + 1).padStart(2, '0')}`,
      text,
      dimension,
      keyedPole: DIMENSION_POLES[dimension][0],
      displayOrder: i * DIMENSION_ORDER.length + dimIndex + 1,
    })),
  );

/** Maps the Likert scale onto (pole, magnitude) options for one question. */
export function buildOptionSeeds(
  question: Pick<PersonalityQuestionSeed, 'dimension' | 'keyedPole'>,
): PersonalityOptionSeed[] {
  const [first, second] = DIMENSION_POLES[question.dimension];
  const opposite = question.keyedPole === first ? second : first;

  return LIKERT_SCALE.map((choice, index) => ({
    optionKey: choice.key,
    optionText: choice.text,
    scoreDirection: choice.agreement >= 0 ? question.keyedPole : opposite,
    scoreValue: Math.abs(choice.agreement),
    displayOrder: index + 1,
  }));
}
