import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { ChatbotCategory } from '../enums/chatbot-category.enum';

export class SearchFaqDto {
  @ApiPropertyOptional({ description: 'Keyword search query' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  query?: string;

  @ApiPropertyOptional({ enum: ChatbotCategory, description: 'Filter by category' })
  @IsOptional()
  @IsEnum(ChatbotCategory)
  category?: ChatbotCategory;

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
}
