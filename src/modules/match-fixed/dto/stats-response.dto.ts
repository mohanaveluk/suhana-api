import { ApiProperty } from '@nestjs/swagger';

export class SuccessStatsResponseDto {
  @ApiProperty({ example: 15000, description: 'Total active Match Fixed records' })
  totalMatchFixed: number;

  @ApiProperty({ example: 9200, description: 'Couples who have a marriage date set' })
  totalMarried: number;

  @ApiProperty({ example: 6500, description: 'Matches that originated through Suhana' })
  suhanaMatches: number;

  @ApiProperty({ example: 8500, description: 'Matches from outside Suhana' })
  externalMatches: number;

  @ApiProperty({ example: 3100, description: 'Verified success stories (both partners confirmed)' })
  verifiedStories: number;
}
