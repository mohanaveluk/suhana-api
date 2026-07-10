import {
  BadRequestException, ForbiddenException, Injectable, NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Anthropic from '@anthropic-ai/sdk';

import { User } from '../user/entity/user.entity';
import { Profile } from '../user/entity/profile.entity';
import { Interest } from '../interests/entity/interest.entity';

import { ChatbotSessionRepository } from './repositories/chatbot-session.repository';
import { ChatbotMessageRepository } from './repositories/chatbot-message.repository';
import { FaqRepository } from './repositories/faq.repository';
import { ChatbotKnowledgeRepository } from './repositories/chatbot-knowledge.repository';
import { FaqSearchService } from './services/faq-search.service';
import { KnowledgeSearchService } from './services/knowledge-search.service';
import { MessageSearchService } from './services/message-search.service';

import { ChatbotMessage } from './entities/chatbot-message.entity';
import { ChatbotFeedback } from './entities/chatbot-feedback.entity';
import { Faq } from './entities/faq.entity';
import { ChatbotKnowledge } from './entities/chatbot-knowledge.entity';

import { SessionStatus } from './enums/session-status.enum';
import { MessageRole } from './enums/message-role.enum';

import { SendMessageDto } from './dto/send-message.dto';
import { SubmitChatbotFeedbackDto } from './dto/chatbot-feedback.dto';
import { SearchFaqDto } from './dto/search-faq.dto';
import { CreateKnowledgeDto, UpdateKnowledgeDto } from './dto/manage-knowledge.dto';
import { ChatbotResponse, UserContextInfo } from './interfaces/chatbot-response.interface';
import { buildSystemPrompt } from './prompts/system-prompt';

const FAQ_CONFIDENCE_THRESHOLD = 0.9;
const KNOWLEDGE_CONFIDENCE_THRESHOLD = 0.8;
const CACHE_CONFIDENCE_THRESHOLD = 0.85;
const AI_MODEL = 'claude-sonnet-4-5'; //'claude-sonnet-4-20250514';
const AI_MAX_TOKENS = 1000;
const HISTORY_DEPTH = 10;

@Injectable()
export class ChatbotService {
  constructor(
    private readonly sessionRepo: ChatbotSessionRepository,
    private readonly messageRepo: ChatbotMessageRepository,
    private readonly faqRepo: FaqRepository,
    private readonly knowledgeRepo: ChatbotKnowledgeRepository,
    private readonly faqSearchService: FaqSearchService,
    private readonly knowledgeSearchService: KnowledgeSearchService,
    private readonly messageSearchService: MessageSearchService,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(ChatbotFeedback)
    private readonly feedbackRepo: Repository<ChatbotFeedback>,
    private readonly anthropic: Anthropic,
  ) {}

  // ── Session ──────────────────────────────────────────────────────────────────

  async createSession(userId: string): Promise<{ sessionId: string; guid: string }> {
    const session = await this.sessionRepo.create(userId);
    return { sessionId: session.id, guid: session.guid };
  }

  // ── Core message flow ─────────────────────────────────────────────────────────

  async sendMessage(userId: string, dto: SendMessageDto): Promise<ChatbotResponse> {
    const startTime = Date.now();

    const session = await this.sessionRepo.findById(dto.sessionId);
    if (!session) throw new NotFoundException('Session not found');
    if (session.userId !== userId) throw new ForbiddenException('Session does not belong to you');
    if (session.status !== SessionStatus.ACTIVE) throw new BadRequestException('Session has ended');

    let savedMessageId = null;
    let savedResponseTimeMs = 0;

    // Step 1 — FAQ match
    const faqResult = await this.faqSearchService.search(dto.message);
    if (faqResult && faqResult.confidence >= FAQ_CONFIDENCE_THRESHOLD) {
      const suggestions = await this.faqSearchService.getSuggestions(faqResult.faq);
      const saved = await this.messageRepo.save({
        sessionId: dto.sessionId,
        userId,
        role: MessageRole.USER,
        message: dto.message,
        response: faqResult.faq.answer,
        source: 'FAQ',
        confidence: faqResult.confidence,
        suggestions: suggestions.join(', ') || null,
        responseTimeMs: Date.now() - startTime,
      });
      return {
        messageId: saved.id,
        answer: faqResult.faq.answer,
        source: 'FAQ',
        confidence: faqResult.confidence,
        suggestions,
        responseTimeMs: saved.responseTimeMs,
      };
    }

    // Step 2 — Knowledge base match
    const knowledgeResult = await this.knowledgeSearchService.search(dto.message);
    if (knowledgeResult && knowledgeResult.confidence >= KNOWLEDGE_CONFIDENCE_THRESHOLD) {
      const suggestions = await this.knowledgeSearchService.getSuggestions(knowledgeResult.knowledge);
      const answer = this.summarizeKnowledge(knowledgeResult.knowledge.content);
      const messageExists = await this.messageRepo.findOne(dto.message);
      if (!messageExists) {
        const saved = await this.messageRepo.save({
          sessionId: dto.sessionId,
          userId,
          role: MessageRole.USER,
          message: dto.message,
          response: answer,
          source: 'KNOWLEDGE',
          confidence: knowledgeResult.confidence,
          suggestions: suggestions.join(', ') || null,
          responseTimeMs: Date.now() - startTime,
        });
        savedMessageId = saved.id;
        savedResponseTimeMs = saved.responseTimeMs;
      }
      return {
        messageId: savedMessageId || messageExists?.id || null,
        answer,
        source: 'KNOWLEDGE',
        confidence: knowledgeResult.confidence,
        suggestions,
        responseTimeMs: savedResponseTimeMs || messageExists?.responseTimeMs || 0,
      };
    }

    // Step 3 — Cached AI response search
    savedMessageId = null;
    savedResponseTimeMs = 0;
    const cachedResult = await this.messageSearchService.search(dto.message);
    if (cachedResult && cachedResult.confidence >= CACHE_CONFIDENCE_THRESHOLD) {
      savedMessageId = cachedResult.cachedMessage.id;
      savedResponseTimeMs = cachedResult.cachedMessage.responseTimeMs || 0;
      // Reconstruct suggestions from the stored CSV; fall back to faqResult if none stored
      const storedSuggestions = cachedResult.cachedMessage.suggestions
        ? cachedResult.cachedMessage.suggestions.split(',').map(s => s.trim()).filter(Boolean)
        : null;
      const suggestions =
        storedSuggestions?.length
          ? storedSuggestions
          : faqResult
            ? await this.faqSearchService.getSuggestions(faqResult.faq)
            : [];
      const messageExists = await this.messageRepo.findOne(dto.message);
      if(!messageExists) {

      

      const saved = await this.messageRepo.save({
        sessionId: dto.sessionId,
        userId,
        role: MessageRole.USER,
        message: dto.message,
        response: cachedResult.cachedMessage.response,
        source: 'CACHE',
        confidence: cachedResult.confidence,
        suggestions: suggestions.join(', ') || null,
        responseTimeMs: Date.now() - startTime,
      });
      savedResponseTimeMs = saved.responseTimeMs;
      savedMessageId = saved.id;
    }
    
      return {
        messageId: savedMessageId,
        answer: cachedResult.cachedMessage.response,
        source: 'CACHE',
        confidence: cachedResult.confidence,
        suggestions,
        responseTimeMs: savedResponseTimeMs,
      };
    }

    // Step 4 — AI fallback (Anthropic)
    const [userCtx, history] = await Promise.all([
      this.loadUserContext(userId),
      this.messageRepo.getHistory(dto.sessionId, HISTORY_DEPTH),
    ]);

    const systemPrompt = buildSystemPrompt({
      userContext: userCtx ? this.formatUserContext(userCtx) : undefined,
      faqContext: faqResult
        ? `Q: ${faqResult.faq.question}\nA: ${faqResult.faq.answer}`
        : undefined,
      knowledgeContext: knowledgeResult
        ? knowledgeResult.knowledge.content.substring(0, 500)
        : undefined,
    });

    const anthropicMessages = this.buildAnthropicMessages(history, dto.message);

    const aiResp = await this.anthropic.messages.create({
      model: AI_MODEL,
      max_tokens: AI_MAX_TOKENS,
      system: systemPrompt,
      messages: anthropicMessages,
    });

    const rawText = aiResp.content[0]?.type === 'text' ? aiResp.content[0].text : '';
    const { answer, suggestions } = this.parseAiResponse(rawText);
    const tokensUsed = (aiResp.usage?.input_tokens ?? 0) + (aiResp.usage?.output_tokens ?? 0);

    const saved = await this.messageRepo.save({
      sessionId: dto.sessionId,
      userId,
      role: MessageRole.USER,
      message: dto.message,
      response: answer,
      source: 'AI',
      confidence: null,
      tokensUsed,
      suggestions: suggestions.join(', ') || null,
      responseTimeMs: Date.now() - startTime,
    });

    return {
      messageId: saved.id,
      answer,
      source: 'AI',
      confidence: 0,
      suggestions,
      tokensUsed,
      responseTimeMs: saved.responseTimeMs,
    };
  }

  // ── History ───────────────────────────────────────────────────────────────────

  async getHistory(userId: string, sessionId: string): Promise<ChatbotMessage[]> {
    const session = await this.sessionRepo.findById(sessionId);
    if (!session) throw new NotFoundException('Session not found');
    if (session.userId !== userId) throw new ForbiddenException('Access denied');
    return this.messageRepo.getBySession(sessionId);
  }

  // ── Feedback ──────────────────────────────────────────────────────────────────

  async submitFeedback(userId: string, dto: SubmitChatbotFeedbackDto): Promise<{ message: string }> {
    const feedback = this.feedbackRepo.create({
      messageId: dto.messageId,
      userId,
      rating: dto.rating,
      comments: dto.comments ?? null,
    });
    await this.feedbackRepo.save(feedback);
    return { message: 'Thank you for your feedback!' };
  }

  // ── FAQ search ────────────────────────────────────────────────────────────────

  async searchFaq(dto: SearchFaqDto): Promise<{ data: Faq[]; total: number; page: number; limit: number }> {
    const [data, total] = await this.faqRepo.search(dto);
    return { data, total, page: dto.page ?? 1, limit: dto.limit ?? 20 };
  }

  // ── Knowledge search ──────────────────────────────────────────────────────────

  async searchKnowledge(
    dto: SearchFaqDto,
  ): Promise<{ data: ChatbotKnowledge[]; total: number; page: number; limit: number }> {
    const [data, total] = await this.knowledgeRepo.search(dto);
    return { data, total, page: dto.page ?? 1, limit: dto.limit ?? 20 };
  }

  // ── Knowledge admin CRUD ──────────────────────────────────────────────────────

  getAllKnowledge(): Promise<ChatbotKnowledge[]> {
    return this.knowledgeRepo.findAll();
  }

  createKnowledge(dto: CreateKnowledgeDto): Promise<ChatbotKnowledge> {
    return this.knowledgeRepo.create(dto);
  }

  updateKnowledge(id: string, dto: UpdateKnowledgeDto): Promise<ChatbotKnowledge> {
    return this.knowledgeRepo.update(id, dto);
  }

  async deleteKnowledge(id: string): Promise<{ message: string }> {
    await this.knowledgeRepo.remove(id);
    return { message: 'Knowledge article deleted' };
  }

  // ── Analytics ─────────────────────────────────────────────────────────────────

  async getStats() {
    const [
      totalSessions,
      activeSessions,
      totalMessages,
      faqHits,
      knowledgeHits,
      cacheHits,
      aiHits,
      metrics,
    ] = await Promise.all([
      this.sessionRepo.count(),
      this.sessionRepo.countActive(),
      this.messageRepo.countAll(),
      this.messageRepo.countBySource('FAQ'),
      this.messageRepo.countBySource('KNOWLEDGE'),
      this.messageRepo.countBySource('CACHE'),
      this.messageRepo.countBySource('AI'),
      this.messageRepo.getAverageMetrics(),
    ]);

    return {
      totalSessions,
      activeSessions,
      totalMessages,
      faqHits,
      knowledgeHits,
      cacheHits,
      aiHits,
      faqHitRate: totalMessages > 0 ? Math.round((faqHits / totalMessages) * 100) : 0,
      knowledgeHitRate: totalMessages > 0 ? Math.round((knowledgeHits / totalMessages) * 100) : 0,
      cacheHitRate: totalMessages > 0 ? Math.round((cacheHits / totalMessages) * 100) : 0,
      averageResponseTimeMs: metrics.avgResponseTime,
      averageTokensUsed: metrics.avgTokens,
    };
  }

  getTopQuestions(limit = 10) {
    return this.messageRepo.getTopQuestions(limit);
  }

  getUnanswered(limit = 20) {
    return this.messageRepo.getUnansweredTopics(limit);
  }

  // ── Private helpers ───────────────────────────────────────────────────────────

  private async loadUserContext(userId: string): Promise<UserContextInfo | null> {
    const user = await this.userRepo.findOne({
      where: { id: userId },
      relations: ['profile', 'profile.photos'],
    });
    if (!user) return null;

    return {
      userId,
      name: [user.first_name, user.last_name].filter(Boolean).join(' ') || 'Member',
      membership: user.membership,
      profileCompleteness: (user.profile as any)?.profileCompleteness ?? 0,
      photoCount: (user.profile as any)?.photos?.length ?? 0,
      interestCount: 0,
    };
  }

  private formatUserContext(ctx: UserContextInfo): string {
    return [
      `Name: ${ctx.name}`,
      `Membership: ${ctx.membership}`,
      `Profile Completeness: ${ctx.profileCompleteness}%`,
      `Photos Uploaded: ${ctx.photoCount}`,
    ].join('\n');
  }

  private buildAnthropicMessages(
    history: ChatbotMessage[],
    currentMessage: string,
  ): { role: 'user' | 'assistant'; content: string }[] {
    const messages: { role: 'user' | 'assistant'; content: string }[] = [];

    for (const h of history) {
      if (h.message) messages.push({ role: 'user', content: h.message });
      if (h.response) messages.push({ role: 'assistant', content: h.response });
    }

    messages.push({ role: 'user', content: currentMessage });
    return messages;
  }

  private parseAiResponse(text: string): { answer: string; suggestions: string[] } {
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          answer: typeof parsed.answer === 'string' ? parsed.answer : text,
          suggestions: Array.isArray(parsed.suggestions)
            ? parsed.suggestions.slice(0, 3).map(String)
            : [],
        };
      }
    } catch {
      // fall through to raw text
    }
    return { answer: text, suggestions: [] };
  }

  private summarizeKnowledge(content: string): string {
    return content.length > 600 ? content.substring(0, 600) + '…' : content;
  }
}
