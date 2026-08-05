import { Controller, Get, Param, Query, Request, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { AuditLogService } from './audit-log.service';
import {
  PaginatedAuditLogDto,
  ProfileUpdateTrustDto,
  QueryAuditLogDto,
  RedFlagQueryDto,
  RedFlagResultDto,
  RiskAnalysisDto,
  TimelineEntryDto,
} from './dto/audit-log.dto';

// User-facing activity & risk endpoints. All require a valid JWT.
@ApiTags('Audit Log')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('audit-log')
export class AuditLogController {
  constructor(private readonly auditLogService: AuditLogService) {}

  // ── API 1 ────────────────────────────────────────────────────────────────
  @Get('user/:userId')
  @ApiOperation({ summary: 'Get paginated user activity history' })
  @ApiParam({ name: 'userId', description: 'User id (uuid)' })
  @ApiResponse({ status: 200, description: 'Paginated audit log', type: PaginatedAuditLogDto })
  async getUserAuditLogs(
    @Param('userId') userId: string,
    @Query() query: QueryAuditLogDto,
  ): Promise<PaginatedAuditLogDto> {
    return this.auditLogService.getAuditLogs(userId, query);
  }

  // ── API 2 ────────────────────────────────────────────────────────────────
  @Get('user/:userId/timeline')
  @ApiOperation({ summary: 'Get chronological activity timeline grouped by day' })
  @ApiParam({ name: 'userId', description: 'User id (uuid)' })
  @ApiResponse({ status: 200, description: 'Timeline entries', type: [TimelineEntryDto] })
  async getUserTimeline(
    @Param('userId') userId: string,
    @Query() query: QueryAuditLogDto,
  ): Promise<TimelineEntryDto[]> {
    return this.auditLogService.getTimeline(userId, query);
  }

  // ── API 3 ────────────────────────────────────────────────────────────────
  @Get('user/:userId/summary')
  @ApiOperation({ summary: 'Get activity summary counts for a user' })
  @ApiParam({ name: 'userId', description: 'User id (uuid)' })
  @ApiResponse({ status: 200, description: 'Keyed activity counts' })
  async getUserSummary(@Param('userId') userId: string): Promise<Record<string, number>> {
    return this.auditLogService.getAuditSummary(userId);
  }

  // ── API 4 ────────────────────────────────────────────────────────────────
  @Get('user/:userId/red-flag')
  @ApiOperation({ summary: 'Generic red-flag detector for a specific event type/window' })
  @ApiParam({ name: 'userId', description: 'User id (uuid)' })
  @ApiResponse({ status: 200, description: 'Red-flag evaluation', type: RedFlagResultDto })
  async getUserRedFlag(
    @Param('userId') userId: string,
    @Query() query: RedFlagQueryDto,
  ): Promise<RedFlagResultDto> {
    return this.auditLogService.detectRedFlag(userId, query);
  }

  // ── API 5 ────────────────────────────────────────────────────────────────
  @Get('user/:userId/risk-analysis')
  @ApiOperation({ summary: 'Advanced multi-factor risk & trust analysis for a user' })
  @ApiParam({ name: 'userId', description: 'User id (uuid)' })
  @ApiResponse({ status: 200, description: 'Risk analysis', type: RiskAnalysisDto })
  async getUserRiskAnalysis(@Param('userId') userId: string): Promise<RiskAnalysisDto> {
    return this.auditLogService.getUserRiskAnalysis(userId);
  }

  // ── API 6 ────────────────────────────────────────────────────────────────
  @Get('profile-indicator/:profileId')
  @ApiOperation({ summary: 'Get profile update indicator by profile ID (admin)' })
  @ApiResponse({ status: 200, description: 'Profile update indicator', type: ProfileUpdateTrustDto })
  @ApiResponse({ status: 403, description: 'Forbidden - admin role required' })
  async getProfileIndicator(
    @Request() req: any,
    @Param('profileId') profileId: string
  ): Promise<ProfileUpdateTrustDto> {
    return this.auditLogService.getProfileIndicatorByUserId(req.user.id, profileId);
  }  
}
