import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNumber, IsOptional, IsString, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class GenerateMatchesDto {
  @ApiPropertyOptional({ example: 4, description: 'Number of matches to generate' })
  @IsOptional() @IsNumber() @Type(() => Number) @Min(1) @Max(10)
  count?: number;
}

export class UpdateMatchStatusDto {
  @ApiProperty({
    enum: ['suggested', 'shortlisted', 'interested', 'connected', 'skipped', 'reconsidered'],
    example: 'shortlisted',
  })
  @IsEnum(['suggested', 'shortlisted', 'interested', 'connected', 'skipped', 'reconsidered'])
  status: string;
}

export class MatchResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  profile: Record<string, unknown>;

  @ApiProperty()
  matchPercentage: number;

  @ApiProperty()
  compatibilityBreakdown: Record<string, number>;

  @ApiProperty()
  explanationText: string;

  @ApiProperty()
  badges: { label: string; icon: string; score: number }[];

  @ApiProperty()
  status: string;

  @ApiProperty()
  currentStep: number;

  @ApiProperty()
  suggestedAt: Date;
}
