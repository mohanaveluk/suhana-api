import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MatchSourceType } from '../enums/match-source-type.enum';
import { MatchFixedStatus } from '../enums/match-fixed-status.enum';

export class MatchFixedResponseDto {
  @ApiProperty({ example: 'uuid-...' })
  id: string;

  @ApiProperty({ example: 'uuid-...' })
  guid: string;

  @ApiProperty({ example: 'uuid-...' })
  userId: string;

  @ApiProperty({ enum: MatchSourceType, example: MatchSourceType.SUHANA })
  matchSourceType: MatchSourceType;

  @ApiProperty({ example: true })
  isMatchFromSuhana: boolean;

  @ApiPropertyOptional({ example: 'uuid-...' })
  matchedUserId?: string;

  @ApiPropertyOptional({ example: 'guid-...' })
  matchedUserGuid?: string;

  @ApiPropertyOptional({ example: 'Ravi Kumar' })
  partnerName?: string;

  @ApiPropertyOptional({ example: 28 })
  partnerAge?: number;

  @ApiPropertyOptional({ example: 'Software Engineer' })
  partnerProfession?: string;

  @ApiPropertyOptional({ example: 'Chennai, Tamil Nadu' })
  partnerLocation?: string;

  @ApiPropertyOptional({ example: 'https://storage.example.com/photo.jpg' })
  partnerPhotoUrl?: string;

  @ApiPropertyOptional({ example: '2026-03-15' })
  engagementDate?: Date;

  @ApiPropertyOptional({ example: '2026-11-22' })
  marriageDate?: Date;

  @ApiPropertyOptional({ example: 'We found each other on Suhana and it was magical...' })
  successStory?: string;

  @ApiProperty({ example: false })
  allowStoryPublish: boolean;

  @ApiProperty({ example: false })
  allowPhotoPublish: boolean;

  @ApiProperty({ enum: MatchFixedStatus, example: MatchFixedStatus.ACTIVE })
  status: MatchFixedStatus;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
