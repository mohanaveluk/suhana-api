import { Injectable } from '@nestjs/common';
import { ReviewSentiment } from '../enums/testimonial.enums';

// Contract every sentiment provider implements. Swap the binding in the module
// to move from the built-in lexical analyzer to OpenAI / Azure OpenAI / Claude /
// Gemini without touching any caller.
export interface SentimentProvider {
  analyze(text: string): Promise<ReviewSentiment>;
}

export const SENTIMENT_PROVIDER = Symbol('SENTIMENT_PROVIDER');

// Default, dependency-free implementation: a lightweight lexicon score. Good
// enough to seed the `sentiment` column immediately and as a fallback if an
// external provider is unavailable. Deterministic → easy to unit test.
@Injectable()
export class LexiconSentimentProvider implements SentimentProvider {
  private static readonly POSITIVE = new Set([
    'good', 'great', 'excellent', 'amazing', 'wonderful', 'love', 'loved', 'happy',
    'perfect', 'best', 'awesome', 'fantastic', 'satisfied', 'helpful', 'genuine',
    'trust', 'trusted', 'recommend', 'recommended', 'success', 'successful', 'thankful',
    'grateful', 'smooth', 'easy', 'supportive', 'reliable', 'safe',
  ]);
  private static readonly NEGATIVE = new Set([
    'bad', 'worst', 'terrible', 'awful', 'hate', 'hated', 'poor', 'fake', 'scam',
    'fraud', 'disappointed', 'disappointing', 'useless', 'waste', 'rude', 'slow',
    'unhelpful', 'unsafe', 'spam', 'horrible', 'never', 'refund', 'cheated', 'bug',
    'issue', 'problem', 'difficult', 'confusing',
  ]);

  async analyze(text: string): Promise<ReviewSentiment> {
    if (!text) return ReviewSentiment.NEUTRAL;
    let score = 0;
    for (const tokenRaw of text.toLowerCase().split(/[^a-z']+/)) {
      const token = tokenRaw.trim();
      if (!token) continue;
      if (LexiconSentimentProvider.POSITIVE.has(token)) score += 1;
      else if (LexiconSentimentProvider.NEGATIVE.has(token)) score -= 1;
    }
    if (score > 0) return ReviewSentiment.POSITIVE;
    if (score < 0) return ReviewSentiment.NEGATIVE;
    return ReviewSentiment.NEUTRAL;
  }
}

// Injectable facade used by the services. Delegates to whichever provider is
// bound to SENTIMENT_PROVIDER and never throws — a provider failure degrades to
// NEUTRAL so it can't block review creation.
@Injectable()
export class SentimentAnalysisService {
  constructor(private readonly provider: SentimentProvider) {}

  async analyzeReview(title: string, body: string): Promise<ReviewSentiment> {
    try {
      return await this.provider.analyze(`${title ?? ''}. ${body ?? ''}`);
    } catch {
      return ReviewSentiment.NEUTRAL;
    }
  }
}
