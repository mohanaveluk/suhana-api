import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { SafetyCategory } from '../enums/safety-category.enum';

export enum SafetyTipsSortBy {
  DISPLAY_ORDER = 'displayOrder',
  VIEW_COUNT = 'viewCount',
  CREATED_AT = 'createdAt',
}

export class QuerySafetyTipsDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({ enum: SafetyCategory, description: 'Filter by category' })
  @IsOptional()
  @IsEnum(SafetyCategory)
  category?: SafetyCategory;

  @ApiPropertyOptional({ description: 'Keyword search across title, description, and content' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @ApiPropertyOptional({ enum: SafetyTipsSortBy, default: SafetyTipsSortBy.DISPLAY_ORDER })
  @IsOptional()
  @IsEnum(SafetyTipsSortBy)
  sortBy?: SafetyTipsSortBy = SafetyTipsSortBy.DISPLAY_ORDER;

  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'asc' })
  @IsOptional()
  @IsEnum(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc' = 'asc';
}
