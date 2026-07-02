import { Controller, Get, Post, Param, UseGuards, Request } from '@nestjs/common';
import {
  ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam,
} from '@nestjs/swagger';

import { MatchFixedService } from './match-fixed.service';
import { AdminDashboardResponseDto } from './dto/admin-dashboard-response.dto';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';

@ApiTags('match-fixed / admin')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('match-fixed')
export class MatchFixedAdminController {
  constructor(private readonly matchFixedService: MatchFixedService) {}

  // GET /match-fixed/admin/dashboard
  @Get('admin/dashboard')
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
  getDashboard(): Promise<AdminDashboardResponseDto> {
    return this.matchFixedService.getAdminDashboard();
  }

  // POST /match-fixed/:id/verify-partner
  @Post(':id/verify-partner')
  @ApiOperation({
    summary: 'Verify a Match Fixed record as the matched partner',
    description:
      'The matched partner (identified by their JWT) confirms the match. ' +
      'Both parties agreeing unlocks the Verified badge on the public success story. ' +
      'Only callable by the user whose ID matches matchedUserId on the record.',
  })
  @ApiParam({ name: 'id', description: 'Match Fixed record UUID to verify' })
  @ApiResponse({
    status: 201,
    description: 'Match verified successfully',
    schema: {
      example: {
        message: 'Match verified successfully. Your success story is now marked as Verified!',
        isVerified: true,
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Already verified or record not active' })
  @ApiResponse({ status: 403, description: 'Only the matched partner can verify this record' })
  @ApiResponse({ status: 404, description: 'Record not found' })
  verifyPartner(
    @Request() req: any,
    @Param('id') id: string,
  ): Promise<{ message: string; isVerified: boolean }> {
    return this.matchFixedService.verifyPartner(req.user.id, id);
  }
}
