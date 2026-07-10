import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean, IsEnum, IsInt, IsNotEmpty, IsOptional,
  IsString, IsUrl, Max, MaxLength, Min,
} from 'class-validator';
import { SafetyCategory } from '../enums/safety-category.enum';

export class CreateSafetyTipDto {
  @ApiProperty({ description: 'Tip title', maxLength: 255 })
  @IsNotEmpty()
  @IsString()
  @MaxLength(255)
  title: string;

  @ApiProperty({ description: 'Brief summary shown in listing cards', maxLength: 500 })
  @IsNotEmpty()
  @IsString()
  @MaxLength(500)
  shortDescription: string;

  @ApiProperty({ description: 'Full HTML/markdown content of the safety tip' })
  @IsNotEmpty()
  @IsString()
  content: string;

  @ApiProperty({ enum: SafetyCategory, description: 'Safety tip category' })
  @IsEnum(SafetyCategory)
  category: SafetyCategory;

  @ApiPropertyOptional({ description: 'Icon name or emoji', maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  icon?: string;

  @ApiPropertyOptional({ description: 'Cover image URL', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  imageUrl?: string;

  @ApiPropertyOptional({ description: 'Explainer video URL', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  videoUrl?: string;

  @ApiPropertyOptional({ description: 'Sort order (lower = first)', default: 0, minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(9999)
  displayOrder?: number;

  @ApiPropertyOptional({ description: 'Show in featured carousel', default: false })
  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;

  @ApiPropertyOptional({ description: 'Make visible to users', default: false })
  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}
