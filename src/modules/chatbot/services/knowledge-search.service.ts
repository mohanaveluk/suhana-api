import { Injectable } from '@nestjs/common';
import { ChatbotKnowledge } from '../entities/chatbot-knowledge.entity';
import { ChatbotKnowledgeRepository } from '../repositories/chatbot-knowledge.repository';
import { FaqRepository } from '../repositories/faq.repository';

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'how', 'what', 'why',
  'when', 'where', 'who', 'can', 'do', 'does', 'did', 'i', 'my', 'to',
  'in', 'on', 'at', 'for', 'of', 'and', 'or', 'not', 'it', 'me', 'we',
  'you', 'will', 'be', 'this', 'that', 'with', 'from', 'by', 'about',
  'get', 'send', 'have', 'has', 'had', 'but', 'if', 'then', 'so', 'up',
]);

@Injectable()
export class KnowledgeSearchService {
  constructor(
    private readonly knowledgeRepo: ChatbotKnowledgeRepository,
    private readonly faqRepo: FaqRepository,
  ) {}

  async search(message: string): Promise<{ knowledge: ChatbotKnowledge; confidence: number } | null> {
    const candidates = await this.knowledgeRepo.findMatchingKnowledge(message);
    if (!candidates.length) return null;

    let best: { knowledge: ChatbotKnowledge; confidence: number } | null = null;

    for (const knowledge of candidates) {
      const searchText = [knowledge.title, knowledge.tags ?? '', knowledge.content.substring(0, 300)].join(' ');
      const confidence = this.computeScore(message, searchText);
      if (!best || confidence > best.confidence) {
        best = { knowledge, confidence };
      }
    }

    return best;
  }

  async getSuggestions(knowledge: ChatbotKnowledge): Promise<string[]> {
    const relatedFaqs = await this.faqRepo.findByCategory(knowledge.category, undefined, 3);
    return relatedFaqs.map(f => f.question);
  }

  private computeScore(message: string, searchText: string): number {
    const tokens = message
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 2 && !STOP_WORDS.has(w));

    if (tokens.length === 0) return 0;

    const text = searchText.toLowerCase();
    const matches = tokens.filter(t => text.includes(t)).length;
    return Math.round((matches / tokens.length) * 1000) / 1000;
  }
}
