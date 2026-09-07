import {
  Controller, Delete, Get, Param, Query, Request, UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags,
} from '@nestjs/swagger';

import { ProfileVisitsService } from './profile-visits.service';
import { ProfileVisitsQueryDto } from './dto/profile-visits-query.dto';
import { PaginatedRecentVisitsResponseDto } from './dto/recent-visit-response.dto';
import {
  ProfileVisitHistoryResponseDto, ProfileVisitMutationResponseDto, VisitStatsResponseDto,
} from './dto/visit-analytics-response.dto';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';

@ApiTags('Profile Visits')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('profile-visits')
export class ProfileVisitsController {
  constructor(private readonly profileVisitsService: ProfileVisitsService) {}

  // GET /api/v1/profile-visits/recent
  @Get('recent')
  @ApiOperation({
    summary: 'My recently visited profiles',
    description:
      'Profiles the authenticated member has viewed, most recent first. ' +
      'One entry per profile — `visitCount` and `lastVisitedAt` reflect repeat visits. ' +
      'Each entry carries the visitor\'s current match status toward that profile, if any.',
  })
  @ApiResponse({ status: 200, type: PaginatedRecentVisitsResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  getRecent(
    @Request() req: any,
    @Query() query: ProfileVisitsQueryDto,
  ): Promise<PaginatedRecentVisitsResponseDto> {
    return this.profileVisitsService.getRecentVisits(req.user.id, query);
  }

  // GET /api/v1/profile-visits/frequent
  @Get('frequent')
  @ApiOperation({
    summary: 'My most frequently visited profiles',
    description: 'Same shape as /recent, ordered by visit count (then recency).',
  })
  @ApiResponse({ status: 200, type: PaginatedRecentVisitsResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  getFrequent(
    @Request() req: any,
    @Query() query: ProfileVisitsQueryDto,
  ): Promise<PaginatedRecentVisitsResponseDto> {
    return this.profileVisitsService.getFrequentVisits(req.user.id, query);
  }

  // GET /api/v1/profile-visits/stats
  @Get('stats')
  @ApiOperation({
    summary: 'My visit activity summary',
    description: 'Counts for a dashboard tile: total profiles in history, visited today, visited this week.',
  })
  @ApiResponse({ status: 200, type: VisitStatsResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  getStats(@Request() req: any): Promise<VisitStatsResponseDto> {
    return this.profileVisitsService.getStats(req.user.id);
  }

  // GET /api/v1/profile-visits/profile/:profileId
  @Get('profile/:profileId')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiOperation({
    summary: 'Visit stats for a profile (admin)',
    description: 'Total views and unique visitors for one profile.',
  })
  @ApiParam({ name: 'profileId', description: 'Profile UUID' })
  @ApiResponse({ status: 200, type: ProfileVisitHistoryResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Admin role required' })
  @ApiResponse({ status: 404, description: 'Profile not found' })
  getProfileHistory(
    @Param('profileId') profileId: string,
  ): Promise<ProfileVisitHistoryResponseDto> {
    return this.profileVisitsService.getProfileVisitHistory(profileId);
  }

  // DELETE /api/v1/profile-visits  — clear all
  @Delete()
  @ApiOperation({
    summary: 'Clear my recently visited history',
    description: 'Soft-deletes every entry in the authenticated member\'s history.',
  })
  @ApiResponse({ status: 200, type: ProfileVisitMutationResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  clearAll(@Request() req: any): Promise<ProfileVisitMutationResponseDto> {
    return this.profileVisitsService.clearAll(req.user.id);
  }

  // DELETE /api/v1/profile-visits/:profileId  — remove one
  @Delete(':profileId')
  @ApiOperation({
    summary: 'Remove one profile from my recently visited list',
    description: 'Soft-deletes a single entry. Re-visiting the profile later starts a fresh counter.',
  })
  @ApiParam({ name: 'profileId', description: 'Profile UUID to remove from the list' })
  @ApiResponse({ status: 200, type: ProfileVisitMutationResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Entry not in the visitor\'s list' })
  deleteOne(
    @Request() req: any,
    @Param('profileId') profileId: string,
  ): Promise<ProfileVisitMutationResponseDto> {
    return this.profileVisitsService.deleteOne(req.user.id, profileId);
  }
}
