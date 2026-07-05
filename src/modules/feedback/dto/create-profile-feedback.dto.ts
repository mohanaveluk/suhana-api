import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum, IsNotEmpty, IsOptional, IsString, IsBoolean,
  IsInt, Min, Max, MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { FeedbackCategory, PROFILE_CATEGORIES } from '../enums/feedback-category.enum';

export class CreateProfileFeedbackDto {
  @ApiProperty({ description: 'Suhana user ID of the profile being reviewed', example: 'uuid-...' })
  @IsString()
  @IsNotEmpty()
  targetUserId: string;

  @ApiPropertyOptional({ description: 'Profile UUID of the target (optional, derived if absent)' })
  @IsOptional()
  @IsString()
  targetProfileId?: string;

  @ApiProperty({
    enum: PROFILE_CATEGORIES,
    description: 'Must be PROFILE_POSITIVE, PROFILE_NEGATIVE, or PROFILE_REPORT',
    example: FeedbackCategory.PROFILE_POSITIVE,
  })
  @IsEnum(FeedbackCategory)
  @IsNotEmpty()
  category: FeedbackCategory;

  @ApiPropertyOptional({ minimum: 1, maximum: 5, example: 5 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  @Type(() => Number)
  rating?: number;

  @ApiProperty({ example: 'Very Genuine Person', maxLength: 300 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  subject: string;

  @ApiProperty({ example: 'Excellent communication and very genuine profile.' })
  @IsString()
  @IsNotEmpty()
  message: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isAnonymous?: boolean;

  @ApiPropertyOptional({ description: 'Screenshot or evidence URL' })
  @IsOptional()
  @IsString()
  attachmentUrl?: string;
}
