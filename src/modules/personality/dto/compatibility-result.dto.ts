import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import {
  CompatibilityLevel,
  PersonalityDimension,
  PersonalityPole,
} from '../enums/personality.enums';

export class CompatibilityProfileDto {
  @ApiProperty({ example: '3f1c2a9e-6b1d-4c1e-9a7f-2d5e8b9c0a11' })
  profileId: string;
  @ApiProperty({ example: 'INFJ' }) personalityType: string;
}

export class DimensionCompatibilityDto {
  @ApiProperty({ enum: PersonalityDimension }) dimension: PersonalityDimension;
  @ApiProperty({ enum: PersonalityPole, example: PersonalityPole.I })
  poleA: PersonalityPole;
  @ApiProperty({ enum: PersonalityPole, example: PersonalityPole.E })
  poleB: PersonalityPole;
  @ApiProperty({ example: false }) aligned: boolean;
  @ApiProperty({ example: 81 }) score: number;
}

export class CommunicationStyleDto {
  @ApiProperty({ example: 'Warm & Inspirational' }) label: string;
  @ApiProperty() description: string;
}

/**
 * Personality compatibility between two profiles. When either member hasn't
 * completed the assessment, only `available: false` and `message` are present.
 */
export class PersonalityCompatibilityResponseDto {
  @ApiProperty({ example: true }) available: boolean;

  @ApiPropertyOptional({
    example:
      'Personality compatibility unavailable because one or both members have not completed the Aurora Personality Assessment.',
  })
  message?: string;

  @ApiPropertyOptional({ type: [CompatibilityProfileDto] })
  profiles?: CompatibilityProfileDto[];
  @ApiPropertyOptional({ example: 84 }) compatibilityScore?: number;
  @ApiPropertyOptional({
    enum: CompatibilityLevel,
    example: CompatibilityLevel.GOOD,
  })
  compatibilityLevel?: CompatibilityLevel;
  @ApiPropertyOptional({ type: [DimensionCompatibilityDto] })
  dimensionBreakdown?: DimensionCompatibilityDto[];
  @ApiPropertyOptional({ type: CommunicationStyleDto })
  communicationStyle?: CommunicationStyleDto;
  @ApiPropertyOptional({ type: [String] }) strengths?: string[];
  @ApiPropertyOptional({ type: [String] }) potentialChallenges?: string[];
  @ApiPropertyOptional({
    example: 'rule-based-v1',
    description: 'Which analyser produced the result',
  })
  analysisVersion?: string;
}
