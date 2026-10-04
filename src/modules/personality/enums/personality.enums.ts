// Values below are persisted verbatim (enum columns, personality_type) — keep them stable.

export enum PersonalityDimension {
  EI = 'EI', // Extroversion vs Introversion
  SN = 'SN', // Sensing vs Intuition
  TF = 'TF', // Thinking vs Feeling
  JP = 'JP', // Judging vs Perceiving
}

export enum PersonalityPole {
  E = 'E',
  I = 'I',
  S = 'S',
  N = 'N',
  T = 'T',
  F = 'F',
  J = 'J',
  P = 'P',
}

export enum AssessmentStatus {
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
}

export enum ConfidenceLevel {
  LOW = 'Low',
  MEDIUM = 'Medium',
  HIGH = 'High',
}

export enum CompatibilityLevel {
  EXCELLENT = 'Excellent',
  GOOD = 'Good',
  MODERATE = 'Moderate',
  CHALLENGING = 'Challenging',
}

// Order letters are combined in: E/I + S/N + T/F + J/P → e.g. INTJ.
export const DIMENSION_ORDER: readonly PersonalityDimension[] = [
  PersonalityDimension.EI,
  PersonalityDimension.SN,
  PersonalityDimension.TF,
  PersonalityDimension.JP,
];

// [first, second] pole per dimension. The first pole wins only on a strict
// majority (E > I ⇒ E, otherwise I), so a tie resolves to the second pole.
export const DIMENSION_POLES: Record<
  PersonalityDimension,
  readonly [PersonalityPole, PersonalityPole]
> = {
  [PersonalityDimension.EI]: [PersonalityPole.E, PersonalityPole.I],
  [PersonalityDimension.SN]: [PersonalityPole.S, PersonalityPole.N],
  [PersonalityDimension.TF]: [PersonalityPole.T, PersonalityPole.F],
  [PersonalityDimension.JP]: [PersonalityPole.J, PersonalityPole.P],
};

export const DIMENSION_LABELS: Record<PersonalityDimension, string> = {
  [PersonalityDimension.EI]: 'Introversion vs Extroversion',
  [PersonalityDimension.SN]: 'Sensing vs Intuition',
  [PersonalityDimension.TF]: 'Thinking vs Feeling',
  [PersonalityDimension.JP]: 'Judging vs Perceiving',
};

export const POLE_LABELS: Record<PersonalityPole, string> = {
  [PersonalityPole.E]: 'Extroversion',
  [PersonalityPole.I]: 'Introversion',
  [PersonalityPole.S]: 'Sensing',
  [PersonalityPole.N]: 'Intuition',
  [PersonalityPole.T]: 'Thinking',
  [PersonalityPole.F]: 'Feeling',
  [PersonalityPole.J]: 'Judging',
  [PersonalityPole.P]: 'Perceiving',
};

export const PERSONALITY_TYPES = [
  'INTJ',
  'INTP',
  'ENTJ',
  'ENTP',
  'INFJ',
  'INFP',
  'ENFJ',
  'ENFP',
  'ISTJ',
  'ISFJ',
  'ESTJ',
  'ESFJ',
  'ISTP',
  'ISFP',
  'ESTP',
  'ESFP',
] as const;

export type PersonalityTypeCode = (typeof PERSONALITY_TYPES)[number];

/** Five-point Likert scale shared by every question. */
export enum LikertOptionKey {
  STRONGLY_AGREE = 'STRONGLY_AGREE',
  AGREE = 'AGREE',
  NEUTRAL = 'NEUTRAL',
  DISAGREE = 'DISAGREE',
  STRONGLY_DISAGREE = 'STRONGLY_DISAGREE',
}

export const PERSONALITY_UNAVAILABLE_MESSAGE =
  'Personality compatibility unavailable because one or both members have not completed the Aurora Personality Assessment.';

export const PROFILE_RESULT_UNAVAILABLE_MESSAGE =
  'This member has not completed the Aurora Personality Assessment yet.';
