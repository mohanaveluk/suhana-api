import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum, IsNotEmpty, IsOptional, IsString, IsBoolean,
  IsNumber, IsDateString, Min, Max, ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';
import { MatchSourceType } from '../enums/match-source-type.enum';

export class CreateMatchFixedDto {
  @ApiProperty({
    enum: MatchSourceType,
    description: 'How the match was found',
    example: MatchSourceType.SUHANA,
  })
  @IsEnum(MatchSourceType)
  @IsNotEmpty()
  matchSourceType: MatchSourceType;

  @ApiPropertyOptional({
    description: 'Suhana user ID of matched partner — required when matchSourceType is SUHANA and matchedUserGuid is absent',
    example: 'a1b2c3d4-...',
  })
  @ValidateIf((o) => o.matchSourceType === MatchSourceType.SUHANA && !o.matchedUserGuid)
  @IsNotEmpty()
  @IsString()
  matchedUserId?: string;

  @ApiPropertyOptional({
    description: 'Suhana user GUID of matched partner — required when matchSourceType is SUHANA and matchedUserId is absent',
    example: 'guid-...',
  })
  @ValidateIf((o) => o.matchSourceType === MatchSourceType.SUHANA && !o.matchedUserId)
  @IsNotEmpty()
  @IsString()
  matchedUserGuid?: string;

  @ApiPropertyOptional({
    description: 'Partner full name — required when matchSourceType is NOT SUHANA',
    example: 'Ravi Kumar',
  })
  @ValidateIf((o) => o.matchSourceType !== MatchSourceType.SUHANA)
  @IsNotEmpty()
  @IsString()
  partnerName?: string;

  @ApiPropertyOptional({ description: 'Partner age', example: 28 })
  @IsOptional()
  @IsNumber()
  @Min(18)
  @Max(100)
  @Type(() => Number)
  partnerAge?: number;

  @ApiPropertyOptional({ description: 'Partner profession', example: 'Software Engineer' })
  @IsOptional()
  @IsString()
  partnerProfession?: string;

  @ApiPropertyOptional({ description: 'Partner location (city, state)', example: 'Chennai, Tamil Nadu' })
  @IsOptional()
  @IsString()
  partnerLocation?: string;

  @ApiPropertyOptional({ description: 'Partner photo URL', example: 'https://storage.example.com/photo.jpg' })
  @IsOptional()
  partnerPhotoUrl?: { originalUrl?: string, displayUrl?: string, thumbnailUrl?: string };

  @ApiPropertyOptional({ description: 'Engagement photo URL', example: 'https://storage.example.com/photo.jpg' })
  @IsOptional()
  engagementPhotoUrl?: { originalUrl?: string, displayUrl?: string, thumbnailUrl?: string };

  @ApiPropertyOptional({ description: 'Wedding photo URL', example: 'https://storage.example.com/photo.jpg' })
  @IsOptional()
  weddingPhotoUrl?: { originalUrl?: string, displayUrl?: string, thumbnailUrl?: string };

  @ApiPropertyOptional({ description: 'Engagement date (YYYY-MM-DD)', example: '2026-03-15' })
  @IsOptional()
  @IsDateString()
  engagementDate?: string;

  @ApiPropertyOptional({ description: 'Marriage date (YYYY-MM-DD)', example: '2026-11-22' })
  @IsOptional()
  @IsDateString()
  marriageDate?: string;

  @ApiPropertyOptional({ description: 'Success story to share with the Suhana community' })
  @IsOptional()
  @IsString()
  successStory?: string;

  @ApiPropertyOptional({ description: 'Consent to publish success story on Suhana', default: false })
  @IsOptional()
  @IsBoolean()
  allowStoryPublish?: boolean;

  @ApiPropertyOptional({ description: 'Consent to publish couple photo on Suhana', default: false })
  @IsOptional()
  @IsBoolean()
  allowPhotoPublish?: boolean;
}
