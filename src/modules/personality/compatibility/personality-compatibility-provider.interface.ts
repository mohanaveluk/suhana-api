import {
  CompatibilityLevel,
  PersonalityDimension,
  PersonalityPole,
} from '../enums/personality.enums';
import { PoleScores } from '../scoring/personality-scoring.engine';

/** What a provider needs to know about one member's completed assessment. */
export interface PersonalitySnapshot {
  profileId: string;
  personalityType: string;
  poleScores: PoleScores;
  confidenceScore: number;
}

export interface DimensionCompatibility {
  dimension: PersonalityDimension;
  poleA: PersonalityPole;
  poleB: PersonalityPole;
  aligned: boolean;
  score: number; // 0–100
}

export interface CommunicationStyle {
  label: string;
  description: string;
}

export interface PersonalityCompatibilityResult {
  compatibilityScore: number; // 0–100
  compatibilityLevel: CompatibilityLevel;
  dimensionBreakdown: DimensionCompatibility[];
  communicationStyle: CommunicationStyle;
  strengths: string[];
  potentialChallenges: string[];
}

/**
 * Contract every compatibility analyser implements. The module binds the
 * rule-based provider by default; an AI-backed analyser (e.g. Claude) can be
 * swapped in by implementing this interface and changing the binding in
 * PersonalityModule — no caller changes.
 */
export interface PersonalityCompatibilityProvider {
  // Identifies the analyser in responses (e.g. 'rule-based-v1', 'claude-v1').
  readonly version: string;
  evaluate(
    a: PersonalitySnapshot,
    b: PersonalitySnapshot,
  ): Promise<PersonalityCompatibilityResult>;
}

export const PERSONALITY_COMPATIBILITY_PROVIDER = Symbol(
  'PERSONALITY_COMPATIBILITY_PROVIDER',
);
