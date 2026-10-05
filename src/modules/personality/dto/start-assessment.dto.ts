import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class StartAssessmentDto {
  @ApiPropertyOptional({
    example: '3f1c2a9e-6b1d-4c1e-9a7f-2d5e8b9c0a11',
    description:
      "Profile taking the assessment. Defaults to the signed-in member's profile; only admins may pass another member's profile.",
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(36)
  profileId?: string;
}
