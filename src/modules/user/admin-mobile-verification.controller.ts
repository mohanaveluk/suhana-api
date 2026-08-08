import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { MobileVerificationService } from './mobile-verification.service';
import {
  AdminMobileVerificationQueryDto,
  PaginatedMobileVerificationHistoryDto,
} from './dto/mobile-verification.dto';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';

@ApiTags('[Admin] Mobile Verification')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('admin/mobile-verification')
export class AdminMobileVerificationController {
  constructor(private readonly mobileVerificationService: MobileVerificationService) {}

  // GET /api/v1/admin/mobile-verification/history
  @Get('history')
  @ApiOperation({
    summary: '[Admin] Mobile verification audit history',
    description:
      'Paginated log of every OTP issued, newest first, with the request context captured ' +
      'at send time (sentAt, ipAddress, userAgent) and the outcome (status, attemptCount, verifiedAt). ' +
      'Filterable by user, mobile number and status. OTP hashes are never returned.',
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated verification history',
    type: PaginatedMobileVerificationHistoryDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized — missing or invalid JWT' })
  @ApiResponse({ status: 403, description: 'Forbidden — admin role required' })
  getHistory(
    @Query() query: AdminMobileVerificationQueryDto,
  ): Promise<PaginatedMobileVerificationHistoryDto> {
    return this.mobileVerificationService.getVerificationHistory(query);
  }
}
