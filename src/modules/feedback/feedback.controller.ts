import {
  Controller, Get, Post, Put, Delete, Body, Param, Query,
  UseGuards, Request,
} from '@nestjs/common';
import {
  ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam, ApiQuery,
} from '@nestjs/swagger';

import { FeedbackService } from './feedback.service';
import { CreateFeedbackDto } from './dto/create-feedback.dto';
import { CreateProfileFeedbackDto } from './dto/create-profile-feedback.dto';
import { ReplyFeedbackDto } from './dto/reply-feedback.dto';
import { FeedbackFilterDto } from './dto/feedback-filter.dto';
import { ApproveFeedbackDto, RejectFeedbackDto } from './dto/approve-reject-feedback.dto';
import {
  FeedbackResponseDto, FeedbackStatsResponseDto, PaginatedFeedbackResponseDto,
} from './dto/feedback-response.dto';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { Public } from 'src/common/decorators/public.decorator';

@ApiTags('Feedback')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('feedback')
export class FeedbackController {
  constructor(private readonly feedbackService: FeedbackService) {}

  // ═══════════════════════════════════════════════════════════════════════════
  // SUBMIT
  // ═══════════════════════════════════════════════════════════════════════════

  @Post()
  @ApiOperation({
    summary: 'Submit general feedback',
    description: 'Submit website, feature, bug, billing, or experience feedback. ' +
      'Triggers admin notification and thank-you email.',
  })
  @ApiResponse({ status: 201, description: 'Feedback submitted', type: FeedbackResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid category or missing fields' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  submitGeneralFeedback(
    @Request() req: any,
    @Body() dto: CreateFeedbackDto,
  ): Promise<FeedbackResponseDto> {
    const domain = `${req.get('origin')}`;
    const ipAddress = req.headers['x-forwarded-for']?.split(',')[0] ?? req.ip;
    return this.feedbackService.createGeneralFeedback(req.user.id, dto, { ipAddress, domain });
  }

  @Post('profile')
  @ApiOperation({
    summary: 'Submit profile feedback',
    description: 'Submit feedback about another member\'s profile. ' +
      'Category must be PROFILE_POSITIVE, PROFILE_NEGATIVE, or PROFILE_REPORT. ' +
      'Notifies the target user and sends a thank-you to the submitter.',
  })
  @ApiResponse({ status: 201, description: 'Profile feedback submitted', type: FeedbackResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid category or self-feedback attempted' })
  @ApiResponse({ status: 404, description: 'Target user not found' })
  submitProfileFeedback(
    @Request() req: any,
    @Body() dto: CreateProfileFeedbackDto,
  ): Promise<FeedbackResponseDto> {
    const domain = `${req.get('origin')}`;
    return this.feedbackService.createProfileFeedback(req.user.id, dto, { domain });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STATIC ROUTES — must come before /:id
  // ═══════════════════════════════════════════════════════════════════════════

  @Get('stats')
  @ApiOperation({ summary: 'Get feedback statistics', description: 'Returns platform-wide feedback counts and average rating.' })
  @ApiResponse({ status: 200, type: FeedbackStatsResponseDto })
  getStats(): Promise<FeedbackStatsResponseDto> {
    return this.feedbackService.getStatistics();
  }

  @Get('my')
  @ApiOperation({ summary: 'Get feedback submitted by me', description: 'Returns all feedback the logged-in user has submitted.' })
  @ApiResponse({ status: 200, type: [FeedbackResponseDto] })
  getMyFeedback(@Request() req: any): Promise<FeedbackResponseDto[]> {
    return this.feedbackService.getMyFeedback(req.user.id);
  }

  @Get('about-me')
  @ApiOperation({ summary: 'Get feedback submitted about me', description: 'Returns all feedback where the logged-in user is the target.' })
  @ApiResponse({ status: 200, type: [FeedbackResponseDto] })
  getFeedbackAboutMe(@Request() req: any): Promise<FeedbackResponseDto[]> {
    return this.feedbackService.getFeedbackAboutMe(req.user.id);
  }

  // ── Public profile feedback display ────────────────────────────────────────

  @Get('profile/:profileId')
  @Public()
  @ApiOperation({
    summary: 'Get approved public feedback for a profile',
    description: 'Public endpoint. Returns only approved + isPublic = true feedback for display on a profile page.',
  })
  @ApiParam({ name: 'profileId', description: 'Profile UUID' })
  @ApiResponse({ status: 200, type: [FeedbackResponseDto] })
  getPublicProfileFeedback(@Param('profileId') profileId: string): Promise<FeedbackResponseDto[]> {
    return this.feedbackService.getPublicProfileFeedback(profileId);
  }

  // ── User-level (all approved feedback for a user) ──────────────────────────

  @Get('user/:userId')
  @ApiOperation({ summary: 'Get all approved feedback for a user' })
  @ApiParam({ name: 'userId', description: 'User UUID' })
  @ApiResponse({ status: 200, type: [FeedbackResponseDto] })
  getFeedbackByUser(@Param('userId') userId: string): Promise<FeedbackResponseDto[]> {
    return this.feedbackService.getFeedbackByUser(userId);
  }

  // ── GUID lookup ────────────────────────────────────────────────────────────

  @Get('guid/:guid')
  @ApiOperation({ summary: 'Get feedback by GUID' })
  @ApiParam({ name: 'guid', description: 'Feedback GUID' })
  @ApiResponse({ status: 200, type: FeedbackResponseDto })
  @ApiResponse({ status: 404, description: 'Not found' })
  getByGuid(@Param('guid') guid: string): Promise<FeedbackResponseDto> {
    return this.feedbackService.getFeedbackByGuid(guid);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ADMIN ROUTES
  // ═══════════════════════════════════════════════════════════════════════════

  @Get()
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiOperation({
    summary: '[Admin] List all feedback with filters',
    description: 'Paginated list. Supports filters: status, category, feedbackType, rating, priority, isPublic, fromDate, toDate.',
  })
  @ApiResponse({ status: 200, type: PaginatedFeedbackResponseDto })
  getAllFeedback(@Query() filter: FeedbackFilterDto): Promise<PaginatedFeedbackResponseDto> {
    return this.feedbackService.getAllFeedback(filter);
  }

  @Put(':id/approve')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: '[Admin] Approve feedback', description: 'Optionally mark as isPublic to show on the target profile.' })
  @ApiParam({ name: 'id', description: 'Feedback UUID' })
  @ApiResponse({ status: 200, type: FeedbackResponseDto })
  approveFeedback(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: ApproveFeedbackDto,
  ): Promise<FeedbackResponseDto> {
    return this.feedbackService.approveFeedback(id, req.user.id, dto);
  }

  @Put(':id/reject')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: '[Admin] Reject feedback' })
  @ApiParam({ name: 'id', description: 'Feedback UUID' })
  @ApiResponse({ status: 200, type: FeedbackResponseDto })
  rejectFeedback(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: RejectFeedbackDto,
  ): Promise<FeedbackResponseDto> {
    return this.feedbackService.rejectFeedback(id, req.user.id, dto);
  }

  @Put(':id/resolve')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: '[Admin] Mark feedback as resolved' })
  @ApiParam({ name: 'id', description: 'Feedback UUID' })
  @ApiResponse({ status: 200, type: FeedbackResponseDto })
  resolveFeedback(
    @Request() req: any,
    @Param('id') id: string,
  ): Promise<FeedbackResponseDto> {
    return this.feedbackService.resolveFeedback(id, req.user.id);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: '[Admin] Soft-delete feedback' })
  @ApiParam({ name: 'id', description: 'Feedback UUID' })
  @ApiResponse({ status: 200, schema: { example: { message: 'Feedback deleted successfully' } } })
  deleteFeedback(@Param('id') id: string): Promise<{ message: string }> {
    return this.feedbackService.deleteFeedback(id);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PARAMETERIZED ROUTES — must come last
  // ═══════════════════════════════════════════════════════════════════════════

  @Get(':id')
  @ApiOperation({ summary: 'Get feedback by ID' })
  @ApiParam({ name: 'id', description: 'Feedback UUID' })
  @ApiResponse({ status: 200, type: FeedbackResponseDto })
  @ApiResponse({ status: 404, description: 'Not found' })
  getFeedbackById(@Param('id') id: string): Promise<FeedbackResponseDto> {
    return this.feedbackService.getFeedbackById(id);
  }

  @Post(':id/reply')
  @ApiOperation({
    summary: 'Add a reply to feedback',
    description: 'The original submitter or an admin can reply. Sends a notification email when an admin replies.',
  })
  @ApiParam({ name: 'id', description: 'Feedback UUID' })
  @ApiResponse({ status: 201, type: FeedbackResponseDto })
  addReply(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: ReplyFeedbackDto,
  ): Promise<FeedbackResponseDto> {
    const isAdmin = req.user?.role === 'admin';
    const domain = `${req.get('origin')}`;
    return this.feedbackService.addReply(id, req.user.id, dto, isAdmin, { domain });
  }

  @Get(':id/replies')
  @ApiOperation({ summary: 'Get replies for a feedback record' })
  @ApiParam({ name: 'id', description: 'Feedback UUID' })
  @ApiResponse({ status: 200, schema: { example: { replyMessage: '...', repliedAt: '...', repliedByUserId: '...' } } })
  getReplies(@Param('id') id: string) {
    return this.feedbackService.getReplies(id);
  }
}
