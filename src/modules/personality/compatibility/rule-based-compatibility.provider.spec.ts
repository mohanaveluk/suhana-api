import {
  CompatibilityLevel,
  PersonalityDimension,
} from '../enums/personality.enums';
import {
  PoleScores,
  emptyPoleScores,
  personalityTypeFromScores,
} from '../scoring/personality-scoring.engine';
import { PersonalitySnapshot } from './personality-compatibility-provider.interface';
import {
  RuleBasedCompatibilityProvider,
  toCompatibilityLevel,
} from './rule-based-compatibility.provider';

// Builds a snapshot with a fully one-sided preference per letter (16 points each).
const snapshot = (type: string, profileId = type): PersonalitySnapshot => {
  const poleScores: PoleScores = emptyPoleScores();
  for (const letter of type) poleScores[letter as keyof PoleScores] = 16;
  return { profileId, personalityType: type, poleScores, confidenceScore: 100 };
};

describe('RuleBasedCompatibilityProvider', () => {
  const provider = new RuleBasedCompatibilityProvider();

  it('identical strong types score at the top of the range', async () => {
    const result = await provider.evaluate(
      snapshot('INFJ', 'a'),
      snapshot('INFJ', 'b'),
    );
    expect(result.compatibilityScore).toBe(93);
    expect(result.compatibilityLevel).toBe(CompatibilityLevel.EXCELLENT);
    expect(result.dimensionBreakdown.every((d) => d.aligned)).toBe(true);
  });

  it('complete opposites score lowest', async () => {
    const result = await provider.evaluate(snapshot('INTJ'), snapshot('ESFP'));
    expect(result.compatibilityScore).toBe(56);
    expect(result.compatibilityLevel).toBe(CompatibilityLevel.CHALLENGING);
    expect(result.dimensionBreakdown.every((d) => !d.aligned)).toBe(true);
  });

  it('weights S/N agreement above E/I agreement', async () => {
    const differOnlyEI = await provider.evaluate(
      snapshot('INFJ'),
      snapshot('ENFJ'),
    );
    const differOnlySN = await provider.evaluate(
      snapshot('INFJ'),
      snapshot('ISFJ'),
    );
    expect(differOnlyEI.compatibilityScore).toBeGreaterThan(
      differOnlySN.compatibilityScore,
    );
  });

  it('is symmetric', async () => {
    const ab = await provider.evaluate(snapshot('ENTP'), snapshot('ISFJ'));
    const ba = await provider.evaluate(snapshot('ISFJ'), snapshot('ENTP'));
    expect(ab.compatibilityScore).toBe(ba.compatibilityScore);
  });

  it('does not heavily penalise different letters when both members are near the middle', async () => {
    const nearlyBalanced = (first: number, second: number) => ({
      ...emptyPoleScores(),
      E: first,
      I: second,
      N: 16,
      F: 16,
      J: 16,
    });
    const a = {
      profileId: 'a',
      personalityType: 'ENFJ',
      poleScores: nearlyBalanced(9, 7),
      confidenceScore: 60,
    };
    const b = {
      profileId: 'b',
      personalityType: 'INFJ',
      poleScores: nearlyBalanced(7, 9),
      confidenceScore: 60,
    };
    expect(personalityTypeFromScores(a.poleScores)).toBe('ENFJ');
    expect(personalityTypeFromScores(b.poleScores)).toBe('INFJ');

    const result = await provider.evaluate(a, b);
    const ei = result.dimensionBreakdown.find(
      (d) => d.dimension === PersonalityDimension.EI,
    );
    expect(ei.aligned).toBe(false);
    expect(ei.score).toBeGreaterThanOrEqual(88); // close to the aligned score of 90
  });

  it('returns one strength and one challenge per dimension plus a communication style', async () => {
    const result = await provider.evaluate(snapshot('ENFP'), snapshot('INFJ'));
    expect(result.strengths).toHaveLength(4);
    expect(result.potentialChallenges).toHaveLength(4);
    expect(result.communicationStyle.label).toBe('Warm & Inspirational');
    expect(result.communicationStyle.description.length).toBeGreaterThan(0);
  });

  it('labels mixed pairs by what they share', async () => {
    expect(
      (await provider.evaluate(snapshot('INTJ'), snapshot('INFJ')))
        .communicationStyle.label,
    ).toBe('Shared Perspective, Different Decision Styles');
    expect(
      (await provider.evaluate(snapshot('INTJ'), snapshot('ISTJ')))
        .communicationStyle.label,
    ).toBe('Shared Values, Different Perspectives');
    expect(
      (await provider.evaluate(snapshot('INTJ'), snapshot('ISFJ')))
        .communicationStyle.label,
    ).toBe('Complementary Opposites');
  });

  it('reports its version', () => {
    expect(provider.version).toBe('rule-based-v1');
  });
});

describe('toCompatibilityLevel', () => {
  it.each([
    [85, CompatibilityLevel.EXCELLENT],
    [84, CompatibilityLevel.GOOD],
    [72, CompatibilityLevel.GOOD],
    [71, CompatibilityLevel.MODERATE],
    [60, CompatibilityLevel.MODERATE],
    [59, CompatibilityLevel.CHALLENGING],
  ])('%i → %s', (score, level) => {
    expect(toCompatibilityLevel(score)).toBe(level);
  });
});
