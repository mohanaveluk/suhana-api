import {
  Controller, Get, Post, Put, Delete,
  Body, Param, Query, Request, UseGuards,
} from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import {
  ApiTags, ApiOperation, ApiResponse, ApiBearerAuth,
  ApiParam, ApiQuery,
} from '@nestjs/swagger';

import { ChatbotService } from './chatbot.service';
import { GuestChatbotResolverService } from './services/guest-chatbot-resolver.service';
import { CreateSessionDto } from './dto/create-session.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { GuestMessageDto } from './dto/guest-message.dto';
import { SubmitChatbotFeedbackDto } from './dto/chatbot-feedback.dto';
import { SearchFaqDto } from './dto/search-faq.dto';
import { CreateKnowledgeDto, UpdateKnowledgeDto } from './dto/manage-knowledge.dto';

import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { Public } from 'src/common/decorators/public.decorator';

@ApiTags('Chatbot')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('chatbot')
export class ChatbotController {
  constructor(
    private readonly chatbotService: ChatbotService,
    private readonly guestChatbotResolverService: GuestChatbotResolverService,
  ) {}

  // ═══════════════════════════════════════════════════════════════════════════
  // SESSION
  // ═══════════════════════════════════════════════════════════════════════════

  @Post('session')
  @ApiOperation({
    summary: 'Create a new chatbot session',
    description: 'Creates a new conversation session. Returns sessionId required for all subsequent messages.',
  })
  @ApiResponse({
    status: 201,
    description: 'Session created',
    schema: { example: { sessionId: 'uuid', guid: 'uuid' } },
  })
  createSession(@Request() req: any, @Body() dto: CreateSessionDto) {
    return this.chatbotService.createSession(req.user.id);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MESSAGE
  // ═══════════════════════════════════════════════════════════════════════════

  @Post('message')
  @ApiOperation({
    summary: 'Send a message to the AI assistant',
    description: `Chat flow:
1. FAQ search (confidence ≥ 90%) → instant answer
2. Knowledge base search (confidence ≥ 80%) → knowledge answer
3. Anthropic Claude AI fallback with conversation memory and user context`,
  })
  @ApiResponse({
    status: 201,
    description: 'AI response with source, confidence, and follow-up suggestions',
    schema: {
      example: {
        messageId: 'uuid',
        answer: 'To send interest, go to a profile and click the "Send Interest" button...',
        source: 'FAQ',
        confidence: 0.95,
        suggestions: [
          'How do I cancel an interest?',
          'Can I send unlimited interests?',
          'What happens when someone accepts my interest?',
        ],
        responseTimeMs: 42,
      },
    },
  })
  @ApiResponse({ status: 400, description: 'Session has ended' })
  @ApiResponse({ status: 403, description: 'Session does not belong to you' })
  @ApiResponse({ status: 404, description: 'Session not found' })
  sendMessage(@Request() req: any, @Body() dto: SendMessageDto) {
    return this.chatbotService.sendMessage(req.user.id, dto);
  }

  @Public()
  @UseGuards(ThrottlerGuard)
  @Post('public/message')
  @ApiOperation({
    summary: 'Send a message to the guest (unauthenticated) chatbot',
    description: `Guest-safe chat flow — never calls the AI model:
1. Profile/match/personalization intent → immediate "please log in" response
2. FAQ search (confidence ≥ 90%) → instant answer
3. Knowledge base search (confidence ≥ 80%) → knowledge answer
4. Cached pre-approved answer search (confidence ≥ 85%) → cached answer
5. No match → "please log in" fallback`,
  })
  @ApiResponse({
    status: 201,
    description: 'Guest answer with source and login requirement flag',
    schema: {
      example: {
        source: 'faq',
        answer: 'To send interest, go to a profile and click "Send Interest"...',
        requiresLogin: false,
      },
    },
  })
  guestMessage(@Body() dto: GuestMessageDto) {
    return this.guestChatbotResolverService.resolve(dto);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STATIC ROUTES — must be declared before /:param routes
  // ═══════════════════════════════════════════════════════════════════════════

  // ── FAQ ────────────────────────────────────────────────────────────────────

  @Get('faq/search')
  @ApiOperation({ summary: 'Search FAQs', description: 'Search the FAQ database by keyword and/or category.' })
  @ApiResponse({ status: 200, description: 'Paginated FAQ results' })
  searchFaq(@Query() dto: SearchFaqDto) {
    return this.chatbotService.searchFaq(dto);
  }

  // ── Knowledge ──────────────────────────────────────────────────────────────

  @Get('knowledge/search')
  @ApiOperation({ summary: 'Search knowledge base', description: 'Search knowledge articles by keyword and/or category.' })
  @ApiResponse({ status: 200, description: 'Paginated knowledge results' })
  searchKnowledge(@Query() dto: SearchFaqDto) {
    return this.chatbotService.searchKnowledge(dto);
  }

  @Get('knowledge')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: '[Admin] List all knowledge articles' })
  @ApiResponse({ status: 200, description: 'All knowledge articles' })
  getAllKnowledge() {
    return this.chatbotService.getAllKnowledge();
  }

  @Post('knowledge')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: '[Admin] Create a knowledge article' })
  @ApiResponse({ status: 201, description: 'Knowledge article created' })
  createKnowledge(@Body() dto: CreateKnowledgeDto) {
    return this.chatbotService.createKnowledge(dto);
  }

  // ── Analytics ──────────────────────────────────────────────────────────────

  @Get('stats')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiOperation({
    summary: '[Admin] Chatbot analytics',
    description: 'Returns session counts, message counts, FAQ/knowledge/AI hit rates, avg response time, avg tokens.',
  })
  @ApiResponse({ status: 200, description: 'Stats object' })
  getStats() {
    return this.chatbotService.getStats();
  }

  @Get('top-questions')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: '[Admin] Top questions asked', description: 'Most frequently asked user messages.' })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
  @ApiResponse({ status: 200, description: 'Top questions with counts' })
  getTopQuestions(@Query('limit') limit?: number) {
    return this.chatbotService.getTopQuestions(limit ? Number(limit) : 10);
  }

  @Get('unanswered')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiOperation({
    summary: '[Admin] Unanswered / AI-fallback topics',
    description: 'Messages that fell through FAQ and knowledge and required the AI — candidates for new FAQ entries.',
  })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 20 })
  @ApiResponse({ status: 200, description: 'Unanswered topic list with counts' })
  getUnanswered(@Query('limit') limit?: number) {
    return this.chatbotService.getUnanswered(limit ? Number(limit) : 20);
  }

  // ── Feedback ───────────────────────────────────────────────────────────────

  @Post('feedback')
  @ApiOperation({
    summary: 'Submit feedback on a chatbot response',
    description: 'Rate a specific message as HELPFUL, NOT_HELPFUL, or NEEDS_IMPROVEMENT.',
  })
  @ApiResponse({ status: 201, description: 'Feedback recorded' })
  submitFeedback(@Request() req: any, @Body() dto: SubmitChatbotFeedbackDto) {
    return this.chatbotService.submitFeedback(req.user.id, dto);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PARAMETERIZED ROUTES — must come last
  // ═══════════════════════════════════════════════════════════════════════════

  @Get('history/:sessionId')
  @ApiOperation({ summary: 'Get conversation history for a session' })
  @ApiParam({ name: 'sessionId', description: 'Session UUID' })
  @ApiResponse({ status: 200, description: 'All messages for the session' })
  @ApiResponse({ status: 403, description: 'Session belongs to another user' })
  @ApiResponse({ status: 404, description: 'Session not found' })
  getHistory(@Request() req: any, @Param('sessionId') sessionId: string) {
    return this.chatbotService.getHistory(req.user.id, sessionId);
  }

  @Put('knowledge/:id')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: '[Admin] Update a knowledge article' })
  @ApiParam({ name: 'id', description: 'Knowledge article UUID' })
  @ApiResponse({ status: 200, description: 'Updated article' })
  @ApiResponse({ status: 404, description: 'Article not found' })
  updateKnowledge(@Param('id') id: string, @Body() dto: UpdateKnowledgeDto) {
    return this.chatbotService.updateKnowledge(id, dto);
  }

  @Delete('knowledge/:id')
  @UseGuards(RolesGuard)
  @Roles('admin')
  @ApiOperation({ summary: '[Admin] Delete a knowledge article' })
  @ApiParam({ name: 'id', description: 'Knowledge article UUID' })
  @ApiResponse({ status: 200, schema: { example: { message: 'Knowledge article deleted' } } })
  @ApiResponse({ status: 404, description: 'Article not found' })
  deleteKnowledge(@Param('id') id: string) {
    return this.chatbotService.deleteKnowledge(id);
  }
}
