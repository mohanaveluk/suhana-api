import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { PaginationQueryDto } from 'src/common/dto/pagination.dto';
import { AdminReviewsService } from '../services/admin-reviews.service';
import {
  AdminReportsQueryDto,
  AdminReviewListQueryDto,
  FeatureReviewDto,
  RejectReviewDto,
  ResolveReportDto,
} from '../dto/review.dto';
import { VerifyMarriageDto } from '../dto/success-story.dto';
import { ReportStatus } from '../enums/testimonial.enums';

// All routes require a valid JWT AND the "admin" role.
@ApiTags('Admin - Reviews')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('admin')
export class AdminReviewsController {
  constructor(private readonly service: AdminReviewsService) {}

  @Get('reviews')
  @ApiOperation({
    summary: 'List reviews filtered by status and/or featured flag',
    description:
      'status omitted → all statuses. Examples: ?status=APPROVED, ?status=PENDING, ' +
      '?status=REJECTED, ?status=APPROVED&featured=true&reviewType=MEMBERSHIP, or no filters for everything.',
  })
  @ApiResponse({ status: 200, description: 'Paginated reviews' })
  listReviews(@Query() q: AdminReviewListQueryDto) {
    return this.service.listReviews(q);
  }

  @Get('reviews/pending')
  @ApiOperation({ summary: 'List reviews awaiting moderation' })
  pending(@Query() q: PaginationQueryDto) {
    return this.service.listPending(q.page ?? 1, q.limit ?? 20);
  }

  @Get('reviews/approved')
  @ApiOperation({ summary: 'List approved reviews' })
  approved(@Query() q: PaginationQueryDto) {
    return this.service.listApproved(q.page ?? 1, q.limit ?? 20);
  }

  @Get('reviews/reports')
  @ApiOperation({ summary: 'List review reports' })
  reports(@Query() q: AdminReportsQueryDto) {
    return this.service.listReports(q.status, q.page ?? 1, q.limit ?? 20);
  }

  @Get('reviews/dashboard')
  @ApiOperation({ summary: 'Moderation dashboard metrics' })
  @ApiResponse({ status: 200, description: 'Dashboard counters' })
  dashboard() {
    return this.service.dashboard();
  }

  @Patch('reviews/:id/approve')
  @ApiOperation({ summary: 'Approve a review (publishes it)' })
  @ApiParam({ name: 'id' })
  approve(@Request() req: any, @Param('id') id: string) {
    return this.service.approve(req.user.id, id);
  }

  @Patch('reviews/:id/reject')
  @ApiOperation({ summary: 'Reject a review' })
  @ApiParam({ name: 'id' })
  reject(@Request() req: any, @Param('id') id: string, @Body() dto: RejectReviewDto) {
    return this.service.reject(req.user.id, id, dto);
  }

  @Patch('reviews/:id/feature')
  @ApiOperation({ summary: 'Feature / unfeature a review on the homepage' })
  @ApiParam({ name: 'id' })
  feature(@Request() req: any, @Param('id') id: string, @Body() dto: FeatureReviewDto) {
    return this.service.setFeatured(req.user.id, id, dto);
  }

  @Patch('reports/:id/resolve')
  @ApiOperation({ summary: 'Resolve or dismiss a report' })
  @ApiParam({ name: 'id' })
  resolveReport(@Request() req: any, @Param('id') id: string, @Body() dto: ResolveReportDto) {
    return this.service.resolveReport(req.user.id, id, dto.status ?? ReportStatus.RESOLVED);
  }

  // ── Success story moderation + Verified Marriage Badge ─────────────────────
  @Patch('success-stories/:id/approve')
  @ApiOperation({ summary: 'Approve a success story' })
  @ApiParam({ name: 'id' })
  approveStory(@Request() req: any, @Param('id') id: string) {
    return this.service.approveStory(req.user.id, id);
  }

  @Patch('success-stories/:id/verify-marriage')
  @ApiOperation({ summary: 'Verify (or reject) a marriage → grants the Verified Success Story badge' })
  @ApiParam({ name: 'id' })
  verifyMarriage(@Request() req: any, @Param('id') id: string, @Body() dto: VerifyMarriageDto) {
    return this.service.verifyMarriage(req.user.id, id, dto);
  }
}
