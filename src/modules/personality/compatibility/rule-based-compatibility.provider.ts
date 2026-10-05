import { Injectable } from '@nestjs/common';

import {
  CompatibilityLevel,
  DIMENSION_ORDER,
  DIMENSION_POLES,
  PersonalityDimension,
  PersonalityPole,
} from '../enums/personality.enums';
import {
  dimensionPosition,
  dominantPole,
} from '../scoring/personality-scoring.engine';
import {
  CommunicationStyle,
  DimensionCompatibility,
  PersonalityCompatibilityProvider,
  PersonalityCompatibilityResult,
  PersonalitySnapshot,
} from './personality-compatibility-provider.interface';

interface DimensionRule {
  weight: number;
  // Score when both members sit at the same point on the dimension…
  alignedScore: number;
  // …and when they sit at opposite extremes. Real pairs land in between.
  opposedScore: number;
  // Copy keyed by the pair's poles: the first pole, the second pole, or 'mixed'.
  strengths: Record<'first' | 'second' | 'mixed', string>;
  challenges: Record<'first' | 'second' | 'mixed', string>;
  communication: Record<'first' | 'second' | 'mixed', string>;
}

/**
 * Weights follow common relationship-research heuristics for type pairings:
 * a shared S/N preference (how you take in information and talk about the
 * world) matters most for everyday understanding; E/I differences are often
 * complementary, so they cost little.
 */
const RULES: Record<PersonalityDimension, DimensionRule> = {
  [PersonalityDimension.EI]: {
    weight: 0.2,
    alignedScore: 90,
    opposedScore: 75,
    strengths: {
      first:
        'You share an outgoing energy — family functions, friends and new experiences recharge you both.',
      second:
        'You both value calm, meaningful time together and deep one-on-one conversation.',
      mixed:
        'One of you brings social energy and the other brings calm depth, so you balance each other well.',
    },
    challenges: {
      first:
        'With two busy social calendars, make deliberate time for quiet one-on-one connection.',
      second:
        'Neither of you may naturally initiate social plans — agree on how much family and social time you both want.',
      mixed:
        "You recharge differently — one through people, the other through quiet time. Respect each other's need for company or space.",
    },
    communication: {
      first:
        'Conversations come easily and often, and you both think out loud.',
      second:
        'You prefer thoughtful, unhurried conversations and may open up best in private moments.',
      mixed:
        'One of you processes by talking while the other reflects before responding, so leave room for pauses.',
    },
  },
  [PersonalityDimension.SN]: {
    weight: 0.35,
    alignedScore: 98,
    opposedScore: 40,
    strengths: {
      first:
        'You are both grounded and practical, sharing a realistic approach to finances, plans and daily life.',
      second:
        'You both love ideas and possibilities, and enjoy dreaming about the future together.',
      mixed:
        'One of you sees the big picture while the other keeps plans grounded — together you can turn dreams into reality.',
    },
    challenges: {
      first:
        'You may both prefer the familiar — make room for new ideas and long-term dreams.',
      second:
        'Big plans can outpace practical follow-through — agree on who handles the details.',
      mixed:
        'You take in information differently: one wants facts and specifics, the other meaning and possibilities, which can cause everyday misunderstandings.',
    },
    communication: {
      first:
        'You both like to talk about concrete details, experiences and practical plans.',
      second:
        'You both enjoy abstract ideas, meaning and future possibilities.',
      mixed:
        'Bridge your styles by pairing big-picture ideas with concrete examples.',
    },
  },
  [PersonalityDimension.TF]: {
    weight: 0.25,
    alignedScore: 90,
    opposedScore: 60,
    strengths: {
      first:
        'You both value honesty and logic, so decisions are made openly and fairly.',
      second:
        'You are both warm and empathetic, creating an emotionally supportive home.',
      mixed:
        'One of you brings objectivity and the other brings empathy — a balanced approach to big family decisions.',
    },
    challenges: {
      first:
        'Emotional needs can be overlooked — make a habit of expressing appreciation and affection.',
      second:
        'You may avoid difficult conversations to keep the peace — raise issues early and kindly.',
      mixed:
        'Directness can feel hurtful to one of you while emotion-led reasoning can feel unclear to the other. Agree on how you will handle disagreements.',
    },
    communication: {
      first: 'You communicate directly and value well-reasoned arguments.',
      second: 'You communicate with warmth and care about how your words land.',
      mixed: 'Balance honest feedback with emotional reassurance.',
    },
  },
  [PersonalityDimension.JP]: {
    weight: 0.2,
    alignedScore: 90,
    opposedScore: 60,
    strengths: {
      first:
        'You both like structure and follow-through, so shared goals, finances and planning feel smooth.',
      second:
        'You are both flexible and spontaneous, bringing adventure and ease to life together.',
      mixed:
        'One of you brings organisation and the other flexibility — together you can plan well and still adapt.',
    },
    challenges: {
      first:
        'Two firm planners can clash over whose plan wins — leave room for flexibility.',
      second:
        'Important tasks and deadlines may slip — agree on simple routines for shared responsibilities.',
      mixed:
        'Different approaches to schedules and deadlines may cause friction. Discuss expectations for planning and household routines.',
    },
    communication: {
      first: 'You both like conversations to reach a clear decision.',
      second: 'You both enjoy open-ended conversations that keep options open.',
      mixed:
        'One of you wants closure while the other wants to keep exploring, so agree when a decision is needed.',
    },
  },
};

// Shared S/N + T/F letters describe a pair's common communication temperament.
const SHARED_TEMPERAMENT_LABELS: Record<string, string> = {
  NT: 'Analytical & Visionary',
  NF: 'Warm & Inspirational',
  ST: 'Practical & Direct',
  SF: 'Caring & Practical',
};

export const COMPATIBILITY_THRESHOLDS = {
  excellent: 85,
  good: 72,
  moderate: 60,
};

export function toCompatibilityLevel(score: number): CompatibilityLevel {
  if (score >= COMPATIBILITY_THRESHOLDS.excellent)
    return CompatibilityLevel.EXCELLENT;
  if (score >= COMPATIBILITY_THRESHOLDS.good) return CompatibilityLevel.GOOD;
  if (score >= COMPATIBILITY_THRESHOLDS.moderate)
    return CompatibilityLevel.MODERATE;
  return CompatibilityLevel.CHALLENGING;
}

/**
 * Deterministic, explainable compatibility from two completed assessments.
 *
 * Per dimension, similarity = 1 − |positionA − positionB| / 2, where position is
 * the preference strength in [-1, 1]. The dimension score interpolates between
 * opposedScore and alignedScore by that similarity, so two people who are both
 * near the middle of a dimension aren't penalised for landing on different
 * letters. The overall score is the weighted sum.
 */
@Injectable()
export class RuleBasedCompatibilityProvider
  implements PersonalityCompatibilityProvider
{
  readonly version = 'rule-based-v1';

  async evaluate(
    a: PersonalitySnapshot,
    b: PersonalitySnapshot,
  ): Promise<PersonalityCompatibilityResult> {
    const dimensionBreakdown: DimensionCompatibility[] = [];
    const strengths: string[] = [];
    const potentialChallenges: string[] = [];
    let weighted = 0;

    for (const dimension of DIMENSION_ORDER) {
      const rule = RULES[dimension];
      const poleA = dominantPole(a.poleScores, dimension);
      const poleB = dominantPole(b.poleScores, dimension);
      const similarity =
        1 -
        Math.abs(
          dimensionPosition(a.poleScores, dimension) -
            dimensionPosition(b.poleScores, dimension),
        ) /
          2;
      const score = Math.round(
        rule.opposedScore +
          (rule.alignedScore - rule.opposedScore) * similarity,
      );

      dimensionBreakdown.push({
        dimension,
        poleA,
        poleB,
        aligned: poleA === poleB,
        score,
      });
      weighted += score * rule.weight;

      const variant = this.variantFor(dimension, poleA, poleB);
      strengths.push(rule.strengths[variant]);
      potentialChallenges.push(rule.challenges[variant]);
    }

    const compatibilityScore = Math.round(weighted);

    return {
      compatibilityScore,
      compatibilityLevel: toCompatibilityLevel(compatibilityScore),
      dimensionBreakdown,
      communicationStyle: this.communicationStyle(dimensionBreakdown),
      strengths,
      potentialChallenges,
    };
  }

  private variantFor(
    dimension: PersonalityDimension,
    poleA: PersonalityPole,
    poleB: PersonalityPole,
  ) {
    if (poleA !== poleB) return 'mixed' as const;
    return poleA === DIMENSION_POLES[dimension][0]
      ? ('first' as const)
      : ('second' as const);
  }

  private communicationStyle(
    breakdown: DimensionCompatibility[],
  ): CommunicationStyle {
    const byDimension = new Map(breakdown.map((d) => [d.dimension, d]));
    const sn = byDimension.get(PersonalityDimension.SN);
    const tf = byDimension.get(PersonalityDimension.TF);

    let label: string;
    if (sn.aligned && tf.aligned)
      label = SHARED_TEMPERAMENT_LABELS[`${sn.poleA}${tf.poleA}`];
    else if (sn.aligned)
      label = 'Shared Perspective, Different Decision Styles';
    else if (tf.aligned) label = 'Shared Values, Different Perspectives';
    else label = 'Complementary Opposites';

    const description = [
      PersonalityDimension.EI,
      PersonalityDimension.SN,
      PersonalityDimension.TF,
    ]
      .map((dimension) => {
        const d = byDimension.get(dimension);
        return RULES[dimension].communication[
          this.variantFor(dimension, d.poleA, d.poleB)
        ];
      })
      .join(' ');

    return { label, description };
  }
}
