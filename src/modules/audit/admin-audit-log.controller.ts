import { Controller, Get, Query, UseGuards, Request, Param } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { AuditLogService } from './audit-log.service';
import {
  AdminAuditLogQueryDto,
  PaginatedAuditLogDto,
  ProfileUpdateTrustDto,
  RiskAnalysisDto,
  TopRedFlagsQueryDto,
} from './dto/audit-log.dto';

// Admin-only audit endpoints. Requires a valid JWT AND the "admin" role.
@ApiTags('Admin - Audit Log')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('admin/audit-log')
export class AdminAuditLogController {
  constructor(private readonly auditLogService: AuditLogService) {}

  // ── API 6 ────────────────────────────────────────────────────────────────
  @Get()
  @ApiOperation({ summary: 'Search audit logs across all users (admin)' })
  @ApiResponse({ status: 200, description: 'Paginated, filtered audit log', type: PaginatedAuditLogDto })
  @ApiResponse({ status: 403, description: 'Forbidden - admin role required' })
  async search(@Query() query: AdminAuditLogQueryDto): Promise<PaginatedAuditLogDto> {
    return this.auditLogService.adminSearch(query);
  }

  // ── API 7 ────────────────────────────────────────────────────────────────
  @Get('red-flags')
  @ApiOperation({ summary: 'Top red-flag users ordered by risk score (admin)' })
  @ApiResponse({ status: 200, description: 'Top risky users (max 100)', type: [RiskAnalysisDto] })
  @ApiResponse({ status: 403, description: 'Forbidden - admin role required' })
  async topRedFlags(@Query() query: TopRedFlagsQueryDto): Promise<RiskAnalysisDto[]> {
    return this.auditLogService.getTopRedFlagUsers(query);
  }
}
