import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import {
  AssessmentStatus,
  ConfidenceLevel,
  PersonalityDimension,
  PersonalityPole,
} from '../enums/personality.enums';

export class StartAssessmentResponseDto {
  @ApiProperty({ example: '9b2f6d1e-0c4a-4e2b-8f3d-7a6c5b4e3d21' })
  assessmentId: string;
  @ApiProperty({ example: '3f1c2a9e-6b1d-4c1e-9a7f-2d5e8b9c0a11' })
  profileId: string;
  @ApiProperty({
    enum: AssessmentStatus,
    example: AssessmentStatus.IN_PROGRESS,
  })
  status: AssessmentStatus;
  @ApiProperty() startedAt: Date;
  @ApiProperty({ example: 32 }) totalQuestions: number;
  @ApiProperty({
    example: false,
    description:
      'True when an existing open assessment was returned instead of creating a new one',
  })
  resumed: boolean;
}

export class ConfidenceDto {
  @ApiProperty({
    example: 68.75,
    description: 'Percentage 0–100: how clear-cut the preferences are',
  })
  score: number;
  @ApiProperty({ enum: ConfidenceLevel, example: ConfidenceLevel.HIGH })
  level: ConfidenceLevel;
}

export class DimensionScoreDto {
  @ApiProperty({ enum: PersonalityDimension, example: PersonalityDimension.EI })
  dimension: PersonalityDimension;
  @ApiProperty({ example: 'Introversion vs Extroversion' }) label: string;
  @ApiProperty({ enum: PersonalityPole, example: PersonalityPole.I })
  dominant: PersonalityPole;
  @ApiProperty({ example: 'Introversion' }) dominantLabel: string;
  @ApiProperty({ example: { E: 3, I: 11 }, description: 'Raw points per pole' })
  scores: Record<string, number>;
  @ApiProperty({
    example: { E: 21, I: 79 },
    description: 'Share of points per pole (sums to 100)',
  })
  percentages: Record<string, number>;
}

export class PersonalityInsightsDto {
  @ApiProperty({ example: 'The Strategist' }) title: string;
  @ApiProperty() summary: string;
  @ApiProperty({ type: [String] }) strengths: string[];
  @ApiProperty({ type: [String] }) growthAreas: string[];
  @ApiProperty() inRelationships: string;
}

/**
 * A profile's assessment result. When the member hasn't completed the
 * assessment, only `available: false` and `message` are present.
 */
export class AssessmentResultDto {
  @ApiProperty({ example: true }) available: boolean;
  @ApiPropertyOptional({
    example:
      'This member has not completed the Aurora Personality Assessment yet.',
  })
  message?: string;
  @ApiPropertyOptional({ example: '9b2f6d1e-0c4a-4e2b-8f3d-7a6c5b4e3d21' })
  assessmentId?: string;
  @ApiPropertyOptional({ example: '3f1c2a9e-6b1d-4c1e-9a7f-2d5e8b9c0a11' })
  profileId?: string;
  @ApiPropertyOptional({ example: 'INTJ' }) personalityType?: string;
  @ApiPropertyOptional() completedDate?: Date;
  @ApiPropertyOptional({ type: ConfidenceDto }) confidence?: ConfidenceDto;
  @ApiPropertyOptional({ type: [DimensionScoreDto] })
  dimensions?: DimensionScoreDto[];
  @ApiPropertyOptional({ type: PersonalityInsightsDto })
  insights?: PersonalityInsightsDto;
}
