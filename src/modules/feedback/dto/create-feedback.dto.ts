import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum, IsNotEmpty, IsOptional, IsString, IsBoolean,
  IsNumber, IsInt, Min, Max, MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { FeedbackCategory, GENERAL_CATEGORIES } from '../enums/feedback-category.enum';

export class CreateFeedbackDto {
  @ApiProperty({
    enum: FeedbackCategory,
    description: 'Feedback category — must not be a PROFILE_* category for general feedback',
    example: FeedbackCategory.FEATURE_REQUEST,
  })
  @IsEnum(FeedbackCategory)
  @IsNotEmpty()
  category: FeedbackCategory;

  @ApiPropertyOptional({
    minimum: 1,
    maximum: 5,
    example: 5,
    description: 'Overall satisfaction rating',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  @Type(() => Number)
  rating?: number;

  @ApiProperty({ example: 'Partner Recommendations', maxLength: 300 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  subject: string;

  @ApiProperty({ example: 'Please add AI-based partner recommendations to the app.' })
  @IsString()
  @IsNotEmpty()
  message: string;

  @ApiPropertyOptional({ default: false, description: 'Submit anonymously' })
  @IsOptional()
  @IsBoolean()
  isAnonymous?: boolean;

  @ApiPropertyOptional({ description: 'URL of an attached screenshot or file' })
  @IsOptional()
  @IsString()
  attachmentUrl?: string;

  @ApiPropertyOptional({ example: 'mobile', description: 'Device type: mobile, tablet, desktop' })
  @IsOptional()
  @IsString()
  deviceType?: string;

  @ApiPropertyOptional({ example: 'Chrome 124' })
  @IsOptional()
  @IsString()
  browser?: string;

  @ApiPropertyOptional({ example: 'Android 14' })
  @IsOptional()
  @IsString()
  osVersion?: string;
}
