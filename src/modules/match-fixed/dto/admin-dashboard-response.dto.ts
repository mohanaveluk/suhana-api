import { ApiProperty } from '@nestjs/swagger';

export class AdminDashboardResponseDto {
  @ApiProperty({ example: 12000, description: 'Total active Match Fixed records' })
  totalMatchesFixed: number;

  @ApiProperty({ example: 7200, description: 'Matches that originated on Suhana' })
  matchesThroughSuhana: number;

  @ApiProperty({ example: 4800, description: 'Matches from family, social media, etc.' })
  matchesOutsideSuhana: number;

  @ApiProperty({ example: 4500, description: 'Records with an engagement date set' })
  engagedCount: number;

  @ApiProperty({ example: 6200, description: 'Records with a marriage date set' })
  marriedCount: number;

  @ApiProperty({ example: 68.5, description: 'Percentage of Match Fixed records that progressed to marriage' })
  successRate: number;

  @ApiProperty({ example: 3100, description: 'Verified success stories — both partners confirmed' })
  verifiedSuccessStories: number;

  @ApiProperty({ example: 2850, description: 'Public success stories (allowStoryPublish = true)' })
  publishedStories: number;
}
