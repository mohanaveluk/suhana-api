import {
  LexiconSentimentProvider,
  SentimentAnalysisService,
} from './sentiment-analysis.service';
import { ReviewSentiment } from '../enums/testimonial.enums';

describe('LexiconSentimentProvider', () => {
  const provider = new LexiconSentimentProvider();

  it('classifies positive text', async () => {
    expect(await provider.analyze('This was a wonderful and helpful experience, highly recommend')).toBe(
      ReviewSentiment.POSITIVE,
    );
  });

  it('classifies negative text', async () => {
    expect(await provider.analyze('Terrible fake profiles, a total scam and waste of money')).toBe(
      ReviewSentiment.NEGATIVE,
    );
  });

  it('classifies neutral text', async () => {
    expect(await provider.analyze('I created an account and browsed some profiles')).toBe(
      ReviewSentiment.NEUTRAL,
    );
  });

  it('treats empty text as neutral', async () => {
    expect(await provider.analyze('')).toBe(ReviewSentiment.NEUTRAL);
  });
});

describe('SentimentAnalysisService', () => {
  it('delegates to the provider', async () => {
    const service = new SentimentAnalysisService(new LexiconSentimentProvider());
    expect(await service.analyzeReview('Great', 'excellent support, loved it')).toBe(
      ReviewSentiment.POSITIVE,
    );
  });

  it('degrades to NEUTRAL if the provider throws', async () => {
    const service = new SentimentAnalysisService({
      analyze: async () => {
        throw new Error('provider down');
      },
    });
    expect(await service.analyzeReview('x', 'y')).toBe(ReviewSentiment.NEUTRAL);
  });
});
