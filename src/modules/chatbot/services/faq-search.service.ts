import { Injectable } from '@nestjs/common';
import { Faq } from '../entities/faq.entity';
import { FaqRepository } from '../repositories/faq.repository';

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'how', 'what', 'why',
  'when', 'where', 'who', 'can', 'do', 'does', 'did', 'i', 'my', 'to',
  'in', 'on', 'at', 'for', 'of', 'and', 'or', 'not', 'it', 'me', 'we',
  'you', 'will', 'be', 'this', 'that', 'with', 'from', 'by', 'about',
  'get', 'send', 'have', 'has', 'had', 'but', 'if', 'then', 'so', 'up',
]);

@Injectable()
export class FaqSearchService {
  constructor(private readonly faqRepo: FaqRepository) {}

  async search(message: string): Promise<{ faq: Faq; confidence: number } | null> {
    const candidates = await this.faqRepo.findMatchingFaqs(message);
    if (!candidates.length) return null;

    let best: { faq: Faq; confidence: number } | null = null;

    for (const faq of candidates) {
      const searchText = [faq.question, faq.keywords ?? ''].join(' ');
      const confidence = this.computeScore(message, searchText);
      if (!best || confidence > best.confidence) {
        best = { faq, confidence };
      }
    }

    return best;
  }

  async getSuggestions(faq: Faq): Promise<string[]> {
    const related = await this.faqRepo.findByCategory(faq.category, faq.id, 3);
    return related.map(f => f.question);
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
