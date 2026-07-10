import { Injectable } from '@nestjs/common';
import { ChatbotMessage } from '../entities/chatbot-message.entity';
import { ChatbotMessageRepository } from '../repositories/chatbot-message.repository';

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'how', 'what', 'why',
  'when', 'where', 'who', 'can', 'do', 'does', 'did', 'i', 'my', 'to',
  'in', 'on', 'at', 'for', 'of', 'and', 'or', 'not', 'it', 'me', 'we',
  'you', 'will', 'be', 'this', 'that', 'with', 'from', 'by', 'about',
  'get', 'send', 'have', 'has', 'had', 'but', 'if', 'then', 'so', 'up',
]);

@Injectable()
export class MessageSearchService {
  constructor(private readonly messageRepo: ChatbotMessageRepository) {}

  async search(
    message: string,
  ): Promise<{ cachedMessage: ChatbotMessage; confidence: number } | null> {
    const candidates = await this.messageRepo.findSimilarMessages(message);
    if (!candidates.length) return null;

    let best: { cachedMessage: ChatbotMessage; confidence: number } | null = null;

    for (const candidate of candidates) {
      const confidence = this.computeScore(message, candidate.message);
      if (!best || confidence > best.confidence) {
        best = { cachedMessage: candidate, confidence };
      }
    }

    return best;
  }

  private computeScore(query: string, storedMessage: string): number {
    const tokens = query
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 2 && !STOP_WORDS.has(w));

    if (tokens.length === 0) return 0;

    const text = storedMessage.toLowerCase();
    const matches = tokens.filter(t => text.includes(t)).length;
    return Math.round((matches / tokens.length) * 1000) / 1000;
  }
}
