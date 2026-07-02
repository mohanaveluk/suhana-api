import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNumber, IsOptional, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { MatchSourceType } from '../enums/match-source-type.enum';

export class PublicStoriesQueryDto {
  @ApiPropertyOptional({ example: 1, description: 'Page number (1-based)' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  page?: number = 1;

  @ApiPropertyOptional({ example: 12, description: 'Records per page (max 50)' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(50)
  @Type(() => Number)
  limit?: number = 12;

  @ApiPropertyOptional({
    enum: MatchSourceType,
    description: 'Filter by how the match was made',
  })
  @IsOptional()
  @IsEnum(MatchSourceType)
  matchSource?: MatchSourceType;
}
