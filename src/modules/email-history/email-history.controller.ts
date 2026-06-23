import {
  Controller, Get, Post, Put, Param, Body, Query,
  UseGuards, Request, ParseIntPipe,
} from '@nestjs/common';
import {
  ApiTags, ApiOperation, ApiResponse, ApiBearerAuth,
  ApiParam, ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { EmailHistoryService } from './email-history.service';
import { CreateEmailHistoryDto } from './dto/create-email-history.dto';

@ApiTags('Email History')
@Controller('email-history')
export class EmailHistoryController {
  constructor(private readonly emailHistoryService: EmailHistoryService) {}

  // ─── Public / internal ────────────────────────────────────────────────────

  @Post()
  @ApiOperation({ summary: 'Create email history record (internal use)' })
  @ApiResponse({ status: 201, description: 'Record created' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  create(@Body() dto: CreateEmailHistoryDto) {
    return this.emailHistoryService.saveEmailHistory({
      emailType:  dto.emailType,
      fromUserId: dto.fromUserId,
      toUserId:   dto.toUserId,
      from:       dto.fromEmail,
      to:         dto.toEmail,
      cc:         dto.ccEmail,
      subject:    dto.subject,
      html:       dto.htmlContent,
      status:     (dto.status as 'SENT' | 'FAILED') ?? 'SENT',
      provider:          dto.provider,
      providerMessageId: dto.providerMessageId,
      metadata:          dto.metadata,
      createdBy:         dto.createdBy,
    });
  }

  // ─── Sent by logged-in user ───────────────────────────────────────────────

  @Get('sent/me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get all emails sent by the current user' })
  @ApiResponse({
    status: 200,
    description: 'List of sent emails',
    schema: {
      example: [{ id: 1, subject: 'Interest Sent', toUserId: '45', sentAt: '2026-01-01' }],
    },
  })
  getSentByMe(@Request() req: any) {
    return this.emailHistoryService.getEmailsSentByUser(req.user.id);
  }

  // ─── Received by logged-in user ───────────────────────────────────────────

  @Get('received/me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get all emails received by the current user' })
  @ApiResponse({
    status: 200,
    description: 'List of received emails',
    schema: {
      example: [{ id: 1, subject: 'Offline Message', fromUserId: '12', sentAt: '2026-01-01' }],
    },
  })
  getReceivedByMe(@Request() req: any) {
    return this.emailHistoryService.getEmailsReceivedByUser(req.user.id);
  }

  // ─── Notification center ──────────────────────────────────────────────────

  @Get('notifications')
  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get notification inbox for the current user' })
  @ApiResponse({
    status: 200,
    description: 'Notification list',
    schema: {
      example: [{ id: 1, subject: 'Interest Accepted', readAt: null, sentAt: '2026-01-01' }],
    },
  })
  getNotifications(@Request() req: any) {
    return this.emailHistoryService.getNotifications(req.user.id);
  }

  // ─── Partner conversation ─────────────────────────────────────────────────

  @Get('conversation')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get full email conversation between two users' })
  @ApiQuery({ name: 'user1Id', required: true, description: 'UUID of first user' })
  @ApiQuery({ name: 'user2Id', required: true, description: 'UUID of second user' })
  @ApiResponse({
    status: 200,
    description: 'Bidirectional email thread',
    schema: {
      example: [
        { subject: 'Interest Sent', fromUserId: '10', toUserId: '20' },
        { subject: 'Offline Message', fromUserId: '20', toUserId: '10' },
      ],
    },
  })
  getConversation(
    @Query('user1Id') user1Id: string,
    @Query('user2Id') user2Id: string,
  ) {
    return this.emailHistoryService.getConversation(user1Id, user2Id);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Get email history record by GUID' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, description: 'Record found' })
  @ApiResponse({ status: 404, description: 'Not found' })
  findById(@Param('id') id: string) { //ParseIntPipe
    return this.emailHistoryService.findByGuid(id);
  }

  // ─── Mark read / opened ───────────────────────────────────────────────────

  @Put(':id/read')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Mark a notification as read (sets readAt = NOW())' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'Marked as read' })
  @ApiResponse({ status: 404, description: 'Not found' })
  markRead(@Param('id', ParseIntPipe) id: number) {
    return this.emailHistoryService.markAsRead(id);
  }

  @Put('/read-all')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Mark a notification as read (sets readAt = NOW())' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'Marked as read' })
  @ApiResponse({ status: 404, description: 'Not found' })
  markAllAsRead(@Request() req: any) {
    return this.emailHistoryService.markAllAsRead(req.user.id);
  }

  @Put(':id/open')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Mark a notification as opened (sets openedAt = NOW())' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({ status: 200, description: 'Marked as opened' })
  @ApiResponse({ status: 404, description: 'Not found' })
  markOpened(@Param('id', ParseIntPipe) id: number) {
    return this.emailHistoryService.markAsOpened(id);
  }
}
