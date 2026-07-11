import { Injectable, Logger } from '@nestjs/common';

import { FaqSearchService } from './faq-search.service';
import { KnowledgeSearchService } from './knowledge-search.service';
import { MessageSearchService } from './message-search.service';
import { GuestMessageDto } from '../dto/guest-message.dto';
import { GuestChatbotResponse } from '../interfaces/guest-chatbot-response.interface';

const FAQ_CONFIDENCE_THRESHOLD = 0.9;
const KNOWLEDGE_CONFIDENCE_THRESHOLD = 0.8;
const CACHE_CONFIDENCE_THRESHOLD = 0.85;

const LOGIN_REQUIRED_MESSAGE = 'This requires you to be logged in. Please log in to continue.';
const NO_MATCH_MESSAGE = "I couldn't find an answer to that. Please log in to ask more detailed questions.";

// Anything about profile search, matches, personalization, or compatibility
// requires an authenticated user's own profile to answer meaningfully — a
// guest can never get a real answer here, so we short-circuit before even
// touching FAQ/knowledge search.
//
// Deliberately no bare 'match'/'matches'/'matching'/'horoscope' entries:
// those are substrings of informational FAQ questions we DO want guests to
// reach (e.g. "How does AI matchmaking work?", "What is horoscope
// matching?"). Every entry below requires a personalization signal ("my",
// "for me", "find/search/show ... profiles/matches") so it only fires on
// requests that need the asker's own profile data.
const RESTRICTED_KEYWORDS = [
  'my profile', 'my matches', 'my match', 'my interest', 'my interests',
  'interest sent', 'interests sent', 'who liked me', 'who viewed me',
  'search profile', 'search profiles', 'find profile', 'find profiles',
  'find me', 'find a match', 'find matches', 'show me profiles', 'show me matches',
  'suggest profile', 'suggest profiles', 'suggest match', 'suggest matches',
  'recommend profile', 'recommend profiles', 'shortlist',
  'my compatibility', 'compatibility score', 'compatible with me',
  'match for me', 'matches for me', 'groom for me', 'bride for me',
  'my account', 'my messages', 'my horoscope match', 'check my horoscope',
  'my kundli match', 'my nakshatra match', 'matching', 'horoscope matching', 
  'kundli matching', 'nakshatra matching', 'horoscope compatibility', 'kundli compatibility', 
  'nakshatra compatibility', 'horoscope compatibility score', 
  'kundli compatibility score', 'nakshatra compatibility score', 'horoscope match for me', 'kundli match for me', 'nakshatra match for me',
];

// This service has zero dependency on Anthropic (or any module that wraps
// it) by design — it only ever reads from FAQ, knowledge-base, and cached
// message tables, so there is no code path here that can trigger a paid
// LLM call for an unauthenticated request.
@Injectable()
export class GuestChatbotResolverService {
  private readonly logger = new Logger(GuestChatbotResolverService.name);

  constructor(
    private readonly faqSearchService: FaqSearchService,
    private readonly knowledgeSearchService: KnowledgeSearchService,
    private readonly messageSearchService: MessageSearchService,
  ) {}

  async resolve(dto: GuestMessageDto): Promise<GuestChatbotResponse> {
    const message = dto.message;

    const faqResult = await this.faqSearchService.search(message);
    if (faqResult && faqResult.confidence >= FAQ_CONFIDENCE_THRESHOLD) {
      return { source: 'faq', answer: faqResult.faq.answer, requiresLogin: false };
    }

    const knowledgeResult = await this.knowledgeSearchService.search(message);
    if (knowledgeResult && knowledgeResult.confidence >= KNOWLEDGE_CONFIDENCE_THRESHOLD) {
      return {
        source: 'knowledgebase',
        answer: this.summarizeKnowledge(knowledgeResult.knowledge.content),
        requiresLogin: false,
      };
    }

    const cachedResult = await this.messageSearchService.search(message);
    if (cachedResult && cachedResult.confidence >= CACHE_CONFIDENCE_THRESHOLD) {
      return { source: 'message', answer: cachedResult.cachedMessage.response, requiresLogin: false };
    }

    type MatchResult = {
      confidence: number;
      source: 'faq' | 'knowledgebase' | 'message';
      answer: string;
    };
    const candidates: MatchResult[] = [
      faqResult && { confidence: faqResult.confidence, source: 'faq' as const, answer: faqResult.faq.answer },
      knowledgeResult && { confidence: knowledgeResult.confidence, source: 'knowledgebase' as const, answer: knowledgeResult.knowledge.content },
      cachedResult && { confidence: cachedResult.confidence, source: 'message' as const, answer: cachedResult.cachedMessage.response },
    ].filter((r): r is MatchResult => r !== null && r !== undefined);

    if (candidates.length > 0) {
      const bestMatch = candidates.reduce((prev, current) =>
        prev.confidence > current.confidence ? prev : current
      );

      this.logger.log(
        `Guest question matched via ${bestMatch.source} (confidence: ${bestMatch.confidence}, ${candidates.length} candidate(s)): "${this.truncate(message)}"`
      );

      return { source: bestMatch.source, answer: bestMatch.answer, requiresLogin: false };
    }    
    
    if (this.isRestrictedIntent(message)) {
      this.logger.log(`Guest asked restricted-intent question: "${this.truncate(message)}"`);
      return { source: 'none', answer: LOGIN_REQUIRED_MESSAGE, requiresLogin: true };
    }

    this.logger.log(`Guest question had no FAQ/knowledge/cache match: "${this.truncate(message)}"`);
    return { source: 'none', answer: NO_MATCH_MESSAGE, requiresLogin: true };
  }

  private isRestrictedIntent(message: string): boolean {
    const lower = message.toLowerCase();
    return RESTRICTED_KEYWORDS.some((k) => lower.includes(k));
  }

  private summarizeKnowledge(content: string): string {
    return content.length > 600 ? content.substring(0, 600) + '…' : content;
  }

  private truncate(message: string): string {
    return message.length > 200 ? message.substring(0, 200) + '…' : message;
  }
}
