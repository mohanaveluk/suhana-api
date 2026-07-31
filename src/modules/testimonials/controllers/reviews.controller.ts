import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
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
import { Public } from 'src/common/decorators/public.decorator';
import { PaginationQueryDto } from 'src/common/dto/pagination.dto';
import { ReviewsService } from '../services/reviews.service';
import { ReviewRepliesService } from '../services/review-replies.service';
import { ReviewLikesService } from '../services/review-likes.service';
import { ReviewReportsService } from '../services/review-reports.service';
import { ReviewAnalyticsService } from '../services/review-analytics.service';
import {
  CreateReplyDto,
  CreateReviewDto,
  PublicReviewQueryDto,
  ReportReviewDto,
  UpdateReviewDto,
} from '../dto/review.dto';

@ApiTags('Reviews')
@Controller('reviews')
export class ReviewsController {
  constructor(
    private readonly reviewsService: ReviewsService,
    private readonly repliesService: ReviewRepliesService,
    private readonly likesService: ReviewLikesService,
    private readonly reportsService: ReviewReportsService,
    private readonly analyticsService: ReviewAnalyticsService,
  ) {}

  // ── Authenticated user endpoints ───────────────────────────────────────────
  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Submit a review' })
  @ApiResponse({ status: 201, description: 'Review submitted (pending moderation)' })
  create(@Request() req: any, @Body() dto: CreateReviewDto) {
    return this.reviewsService.create(req.user.id, dto);
  }

  @Get('my')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get the logged-in user\'s reviews' })
  getMyReviews(@Request() req: any, @Query() q: PaginationQueryDto) {
    return this.reviewsService.getMyReviews(req.user.id, q.page ?? 1, q.limit ?? 20);
  }

  @Get('my-reports')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get reports filed by the logged-in user' })
  getMyReports(@Request() req: any, @Query() q: PaginationQueryDto) {
    return this.reportsService.getMyReports(req.user.id, q.page ?? 1, q.limit ?? 20);
  }

  @Get('analytics')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Review analytics (admin): trends, growth, top categories, most liked/active' })
  getAnalytics() {
    return this.analyticsService.getAnalytics();
  }

  // ── Public endpoints (declare static before :id) ───────────────────────────
  @Public()
  @Get('public/featured')
  @ApiOperation({ summary: 'Featured reviews for the homepage' })
  getFeatured() {
    return this.reviewsService.getFeatured();
  }

  @Public()
  @Get('public/stats')
  @ApiOperation({ summary: 'Aggregate review statistics (totals + star breakdown)' })
  getStats() {
    return this.reviewsService.getStats();
  }

  @Public()
  @Get('public')
  @ApiOperation({ summary: 'List approved reviews with filtering / sorting / search' })
  listPublic(@Query() query: PublicReviewQueryDto) {
    return this.reviewsService.listPublic(query);
  }

  @Public()
  @Get('public/:id')
  @ApiOperation({ summary: 'Public review detail (author, replies, likes)' })
  @ApiParam({ name: 'id' })
  getPublicDetail(@Param('id') id: string, @Request() req: any) {
    return this.reviewsService.getPublicDetail(id, req?.user?.id);
  }

  // ── Replies ────────────────────────────────────────────────────────────────
  @Public()
  @Get(':reviewId/replies')
  @ApiOperation({ summary: 'Get the nested reply tree for a review' })
  @ApiParam({ name: 'reviewId' })
  getReplies(@Param('reviewId') reviewId: string) {
    return this.repliesService.getReplyTree(reviewId);
  }

  @Post(':reviewId/replies')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Reply to a review' })
  createReply(@Request() req: any, @Param('reviewId') reviewId: string, @Body() dto: CreateReplyDto) {
    return this.repliesService.createReply(reviewId, { userId: req.user.id }, dto);
  }

  @Post(':reviewId/replies/:replyId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Reply to another reply (nested)' })
  createNestedReply(
    @Request() req: any,
    @Param('reviewId') reviewId: string,
    @Param('replyId') replyId: string,
    @Body() dto: CreateReplyDto,
  ) {
    return this.repliesService.createReply(reviewId, { userId: req.user.id }, dto, replyId);
  }

  // ── Likes ────────────────────────────────────────────────────────────────
  @Post(':reviewId/like')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Like a review' })
  like(@Request() req: any, @Param('reviewId') reviewId: string) {
    return this.likesService.like(reviewId, req.user.id);
  }

  @Delete(':reviewId/like')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Remove a like from a review' })
  unlike(@Request() req: any, @Param('reviewId') reviewId: string) {
    return this.likesService.unlike(reviewId, req.user.id);
  }

  // ── Reports ────────────────────────────────────────────────────────────────
  @Post(':reviewId/report')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Report a review' })
  report(@Request() req: any, @Param('reviewId') reviewId: string, @Body() dto: ReportReviewDto) {
    return this.reportsService.report(reviewId, req.user.id, dto);
  }

  // ── Update / delete own review (param routes last) ─────────────────────────
  @Put(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Update a review (only while PENDING)' })
  update(@Request() req: any, @Param('id') id: string, @Body() dto: UpdateReviewDto) {
    return this.reviewsService.update(req.user.id, id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Soft-delete a review' })
  remove(@Request() req: any, @Param('id') id: string) {
    return this.reviewsService.softDelete(req.user.id, id);
  }
}
