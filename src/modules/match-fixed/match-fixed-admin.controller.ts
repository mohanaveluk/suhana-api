import { Controller, Get, Post, Body, Param, UseGuards, Request } from '@nestjs/common';
import {
  ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam,
} from '@nestjs/swagger';

import { MatchFixedService, VerifyResult } from './match-fixed.service';
import { AdminDashboardResponseDto } from './dto/admin-dashboard-response.dto';
import { AdminVerifyMatchDto } from './dto/admin-verify-match.dto';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';

@ApiTags('match-fixed / admin')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('match-fixed/admin')
export class MatchFixedAdminController {
  constructor(private readonly matchFixedService: MatchFixedService) {}

  // GET /match-fixed/admin/dashboard
  @Get('dashboard')
  @ApiOperation({
    summary: 'Match Fixed admin dashboard metrics',
    description:
      'Returns platform-wide aggregated statistics for admin use: total matches, Suhana vs external, ' +
      'engaged, married, verified stories, and success rate percentage.',
  })
  @ApiResponse({
    status: 200,
    description: 'Admin dashboard metrics',
    type: AdminDashboardResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — admin role required' })
  getDashboard(): Promise<AdminDashboardResponseDto> {
    return this.matchFixedService.getAdminDashboard();
  }

  // POST /match-fixed/admin/:id/verify
  @Post(':id/verify')
  @ApiOperation({
    summary: 'Verify a Match Fixed record as an admin',
    description:
      'Marks the match as genuine on Suhana\'s authority. This is the verification path for ' +
      'matches made outside Suhana (FAMILY, FRIEND, OTHER_MATRIMONY, ...) where there is no ' +
      'matched Suhana partner to confirm it. Works for any active, not-yet-verified record. ' +
      'The resulting badge reads "Verified by Suhana" (verificationMethod = ADMIN).',
  })
  @ApiParam({ name: 'id', description: 'Match Fixed record UUID to verify' })
  @ApiResponse({
    status: 201,
    description: 'Match verified successfully',
    schema: {
      example: {
        message: 'Match verified by Suhana. The success story is now marked as Verified!',
        isVerified: true,
        verificationMethod: 'ADMIN',
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Already verified or record not active' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — admin role required' })
  @ApiResponse({ status: 404, description: 'Record not found' })
  verifyByAdmin(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: AdminVerifyMatchDto,
  ): Promise<VerifyResult> {
    return this.matchFixedService.verifyByAdmin(req.user.id, id, dto.verificationNote);
  }
}
