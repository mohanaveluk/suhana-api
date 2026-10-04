import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class AssessmentAnswerDto {
  @ApiProperty({
    example: 1,
    description: 'Question id from GET /personality/questions',
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  questionId: number;

  @ApiProperty({
    example: 3,
    description: 'Id of the chosen option for that question',
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  optionId: number;
}

export class SubmitAssessmentDto {
  @ApiPropertyOptional({
    example: '9b2f6d1e-0c4a-4e2b-8f3d-7a6c5b4e3d21',
    description:
      "Assessment returned by /assessment/start. When omitted, the profile's open (IN_PROGRESS) assessment is used, or a new one is created.",
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(36)
  assessmentId?: string;

  @ApiPropertyOptional({
    example: '3f1c2a9e-6b1d-4c1e-9a7f-2d5e8b9c0a11',
    description:
      "Defaults to the signed-in member's profile; only admins may submit for another profile.",
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(36)
  profileId?: string;

  @ApiProperty({
    type: [AssessmentAnswerDto],
    description: 'Exactly one answer for every active question.',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => AssessmentAnswerDto)
  responses: AssessmentAnswerDto[];
}
