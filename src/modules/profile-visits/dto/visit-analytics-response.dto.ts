import { ApiProperty } from '@nestjs/swagger';

/** GET /profile-visits/profile/:profileId — admin view of who has seen a profile. */
export class ProfileVisitHistoryResponseDto {
  @ApiProperty({ example: 'a3f1c2d4-...' }) profileId: string;
  @ApiProperty({ example: 142, description: 'Sum of visit_count across all visitors' }) totalVisits: number;
  @ApiProperty({ example: 58, description: 'Distinct visitors (one row per visitor)' }) uniqueVisitors: number;
}

/** GET /profile-visits/stats — lightweight dashboard summary for the current user. */
export class VisitStatsResponseDto {
  @ApiProperty({ example: 45, description: 'Distinct profiles currently in the visitor\'s history' })
  totalVisitedProfiles: number;

  @ApiProperty({ example: 5, description: 'Profiles visited since local-server midnight today' })
  visitedToday: number;

  @ApiProperty({ example: 18, description: 'Profiles visited in the last 7 days' })
  visitedThisWeek: number;
}

/** DELETE responses. */
export class ProfileVisitMutationResponseDto {
  @ApiProperty({ example: true }) success: boolean;
  @ApiProperty({ example: 'Removed from recently visited' }) message: string;
  @ApiProperty({ example: 1, description: 'Rows affected' }) affected: number;
}
