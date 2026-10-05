import {
  ConfidenceLevel,
  DIMENSION_POLES,
  LikertOptionKey,
  PersonalityDimension,
  PersonalityPole,
} from '../enums/personality.enums';
import {
  PERSONALITY_QUESTION_BANK,
  PersonalityQuestionSeed,
  buildOptionSeeds,
} from '../seed/personality-question-bank';
import {
  ScoredAnswer,
  dimensionPosition,
  dominantPole,
  emptyPoleScores,
  polePercentages,
  scoreAssessment,
  toConfidenceLevel,
} from './personality-scoring.engine';

// Answers every seeded question with the option chosen by `pick`.
const answerAll = (
  pick: (q: PersonalityQuestionSeed) => LikertOptionKey,
): ScoredAnswer[] =>
  PERSONALITY_QUESTION_BANK.map((q) => {
    const options = buildOptionSeeds(q);
    const option = options.find((o) => o.optionKey === pick(q));
    return {
      dimension: q.dimension,
      scoreDirection: option.scoreDirection,
      scoreValue: option.scoreValue,
      maxScoreValue: Math.max(...options.map((o) => o.scoreValue)),
    };
  });

describe('Personality question bank', () => {
  it('has 32 questions, 8 per dimension', () => {
    expect(PERSONALITY_QUESTION_BANK).toHaveLength(32);
    for (const dimension of Object.values(PersonalityDimension)) {
      expect(
        PERSONALITY_QUESTION_BANK.filter((q) => q.dimension === dimension),
      ).toHaveLength(8);
    }
  });

  it('has unique ids, codes and display orders 1–32', () => {
    expect(new Set(PERSONALITY_QUESTION_BANK.map((q) => q.id)).size).toBe(32);
    expect(new Set(PERSONALITY_QUESTION_BANK.map((q) => q.code)).size).toBe(32);
    expect(
      PERSONALITY_QUESTION_BANK.map((q) => q.displayOrder).sort(
        (a, b) => a - b,
      ),
    ).toEqual(Array.from({ length: 32 }, (_, i) => i + 1));
  });

  it('interleaves dimensions in display order', () => {
    const firstFour = [...PERSONALITY_QUESTION_BANK]
      .sort((a, b) => a.displayOrder - b.displayOrder)
      .slice(0, 4)
      .map((q) => q.dimension);
    expect(firstFour).toEqual(['EI', 'SN', 'TF', 'JP']);
  });

  it('maps the Likert scale to +2…-2 toward the keyed pole', () => {
    const options = buildOptionSeeds({
      dimension: PersonalityDimension.EI,
      keyedPole: PersonalityPole.E,
    });
    expect(
      options.map((o) => [o.optionKey, o.scoreDirection, o.scoreValue]),
    ).toEqual([
      [LikertOptionKey.STRONGLY_AGREE, 'E', 2],
      [LikertOptionKey.AGREE, 'E', 1],
      [LikertOptionKey.NEUTRAL, 'E', 0],
      [LikertOptionKey.DISAGREE, 'I', 1],
      [LikertOptionKey.STRONGLY_DISAGREE, 'I', 2],
    ]);
  });

  it('supports reverse-keyed questions', () => {
    const options = buildOptionSeeds({
      dimension: PersonalityDimension.EI,
      keyedPole: PersonalityPole.I,
    });
    expect(options[0]).toMatchObject({ scoreDirection: 'I', scoreValue: 2 });
    expect(options[4]).toMatchObject({ scoreDirection: 'E', scoreValue: 2 });
  });
});

describe('scoreAssessment', () => {
  it('strongly agreeing with everything yields ESTJ at 100% confidence', () => {
    const result = scoreAssessment(
      answerAll(() => LikertOptionKey.STRONGLY_AGREE),
    );
    expect(result.personalityType).toBe('ESTJ');
    expect(result.poleScores).toEqual({
      E: 16,
      I: 0,
      S: 16,
      N: 0,
      T: 16,
      F: 0,
      J: 16,
      P: 0,
    });
    expect(result.confidenceScore).toBe(100);
    expect(result.confidenceLevel).toBe(ConfidenceLevel.HIGH);
  });

  it('strongly disagreeing with everything yields INFP', () => {
    const result = scoreAssessment(
      answerAll(() => LikertOptionKey.STRONGLY_DISAGREE),
    );
    expect(result.personalityType).toBe('INFP');
    expect(result.poleScores).toMatchObject({ I: 16, N: 16, F: 16, P: 16 });
  });

  it('mixes letters per dimension (INTJ)', () => {
    const pick = (q: PersonalityQuestionSeed) =>
      q.dimension === PersonalityDimension.EI ||
      q.dimension === PersonalityDimension.SN
        ? LikertOptionKey.DISAGREE
        : LikertOptionKey.AGREE;
    const result = scoreAssessment(answerAll(pick));
    expect(result.personalityType).toBe('INTJ');
    // every dimension 8 points one way → 32 / 64
    expect(result.confidenceScore).toBe(50);
    expect(result.confidenceLevel).toBe(ConfidenceLevel.MEDIUM);
  });

  it('all-neutral answers tie every dimension → second poles, zero confidence', () => {
    const result = scoreAssessment(answerAll(() => LikertOptionKey.NEUTRAL));
    expect(result.personalityType).toBe('INFP');
    expect(result.confidenceScore).toBe(0);
    expect(result.confidenceLevel).toBe(ConfidenceLevel.LOW);
  });

  it('computes confidence as Σ|differences| over the maximum possible', () => {
    const answers: ScoredAnswer[] = [
      {
        dimension: PersonalityDimension.EI,
        scoreDirection: PersonalityPole.E,
        scoreValue: 2,
        maxScoreValue: 2,
      },
      {
        dimension: PersonalityDimension.EI,
        scoreDirection: PersonalityPole.I,
        scoreValue: 1,
        maxScoreValue: 2,
      },
      {
        dimension: PersonalityDimension.SN,
        scoreDirection: PersonalityPole.N,
        scoreValue: 2,
        maxScoreValue: 2,
      },
    ];
    // |2−1| + |0−2| = 3 out of 6
    expect(scoreAssessment(answers).confidenceScore).toBe(50);
  });

  it('rejects an option scored toward a pole outside its dimension', () => {
    expect(() =>
      scoreAssessment([
        {
          dimension: PersonalityDimension.EI,
          scoreDirection: PersonalityPole.T,
          scoreValue: 2,
          maxScoreValue: 2,
        },
      ]),
    ).toThrow(/does not belong/);
  });

  it('returns zero confidence for no answers', () => {
    expect(scoreAssessment([]).confidenceScore).toBe(0);
  });
});

describe('scoring helpers', () => {
  it('dominantPole requires a strict majority for the first pole', () => {
    const scores = { ...emptyPoleScores(), E: 5, I: 5 };
    expect(dominantPole(scores, PersonalityDimension.EI)).toBe('I');
    expect(dominantPole({ ...scores, E: 6 }, PersonalityDimension.EI)).toBe(
      'E',
    );
  });

  it('confidence levels follow the thresholds', () => {
    expect(toConfidenceLevel(29.99)).toBe(ConfidenceLevel.LOW);
    expect(toConfidenceLevel(30)).toBe(ConfidenceLevel.MEDIUM);
    expect(toConfidenceLevel(60)).toBe(ConfidenceLevel.HIGH);
  });

  it('polePercentages sum to 100 and default to 50/50', () => {
    expect(
      polePercentages(
        { ...emptyPoleScores(), T: 3, F: 9 },
        PersonalityDimension.TF,
      ),
    ).toEqual({ T: 25, F: 75 });
    expect(polePercentages(emptyPoleScores(), PersonalityDimension.JP)).toEqual(
      { J: 50, P: 50 },
    );
  });

  it('dimensionPosition spans -1…1', () => {
    expect(
      dimensionPosition(
        { ...emptyPoleScores(), S: 16 },
        PersonalityDimension.SN,
      ),
    ).toBe(1);
    expect(
      dimensionPosition(
        { ...emptyPoleScores(), N: 16 },
        PersonalityDimension.SN,
      ),
    ).toBe(-1);
    expect(dimensionPosition(emptyPoleScores(), PersonalityDimension.SN)).toBe(
      0,
    );
  });

  it('every dimension has exactly two poles', () => {
    for (const poles of Object.values(DIMENSION_POLES))
      expect(poles).toHaveLength(2);
  });
});
