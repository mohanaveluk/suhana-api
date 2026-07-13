import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MatchSourceType } from '../enums/match-source-type.enum';

export class SuccessStoryResponseDto {
  @ApiProperty({ example: 'uuid-...' })
  id: string;

  @ApiProperty({ example: 'Nandhini' })
  userName: string;

  @ApiPropertyOptional({ example: 'Vikram' })
  partnerName: string;

  @ApiPropertyOptional({ description: 'User profile image URL' })
  profileImageUrl: string | null;

  @ApiPropertyOptional({ description: 'Partner photo URL' })
  partnerPhotoUrl: { originalUrl?: string, displayUrl?: string, thumbnailUrl?: string } | null;

  @ApiPropertyOptional({ description: 'Engagement ceremony photo URL' })
  engagementPhotoUrl: { originalUrl?: string, displayUrl?: string, thumbnailUrl?: string } | null;

  @ApiPropertyOptional({ description: 'Wedding ceremony photo URL' })
  weddingPhotoUrl: { originalUrl?: string, displayUrl?: string, thumbnailUrl?: string } | null;

  @ApiPropertyOptional({ example: 'We found each other on Suhana and it was truly magical...' })
  successStory: string | null;

  @ApiPropertyOptional({ example: '2026-03-15' })
  engagementDate: Date | null;

  @ApiPropertyOptional({ example: '2026-11-22' })
  marriageDate: Date | null;

  @ApiProperty({ enum: MatchSourceType, example: MatchSourceType.SUHANA })
  matchSource: MatchSourceType;

  @ApiProperty({ example: true, description: 'Both partners confirmed this match on Suhana' })
  isVerified: boolean;

  @ApiPropertyOptional({ example: '2026-01-10T00:00:00.000Z' })
  verifiedAt: Date | null;

  @ApiProperty()
  createdAt: Date;
}

export class PaginatedSuccessStoriesDto {
  @ApiProperty({ type: [SuccessStoryResponseDto] })
  data: SuccessStoryResponseDto[];

  @ApiProperty({ example: 150 })
  total: number;

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 12 })
  limit: number;

  @ApiProperty({ example: 13 })
  totalPages: number;
}
