import {
  allowedActions, bestScore, horoscopeBucket, interestStatus, matchesStatusFilter,
} from './member-interactions.service';
import { InteractionCompatibility } from './dto/member-interactions.dto';

describe('My Interests — status, actions and compatibility helpers', () => {
  describe('interestStatus', () => {
    it('a received pending interest is "new" until opened, then "viewed"', () => {
      expect(interestStatus({ status: 'pending', isRead: false }, 'received')).toBe('new');
      expect(interestStatus({ status: 'pending', isRead: true }, 'received')).toBe('viewed');
    });
    it('a sent pending interest is "pending"', () => {
      expect(interestStatus({ status: 'pending', isRead: false }, 'sent')).toBe('pending');
    });
    it('answered interests keep their status', () => {
      for (const s of ['accepted', 'declined', 'withdrawn']) {
        expect(interestStatus({ status: s, isRead: true }, 'received')).toBe(s);
      }
    });
  });

  describe('matchesStatusFilter', () => {
    it('"pending" covers new, viewed and pending', () => {
      expect(['new', 'viewed', 'pending'].every(s => matchesStatusFilter(s as any, 'pending'))).toBe(true);
      expect(matchesStatusFilter('accepted', 'pending')).toBe(false);
    });
    it('profile views (no status) only appear under "all"', () => {
      expect(matchesStatusFilter(null, 'all')).toBe(true);
      expect(matchesStatusFilter(null, 'new')).toBe(false);
    });
  });

  describe('allowedActions', () => {
    const base = { connected: false, interestExists: true };
    it('a new or viewed received interest can be accepted or declined', () => {
      const a = allowedActions({ ...base, type: 'INTEREST', direction: 'received', status: 'new' });
      expect(a).toEqual(expect.arrayContaining(['accept', 'decline']));
      expect(a).not.toContain('withdraw');
    });
    it('a declined or withdrawn interest offers no accept/decline/withdraw/message', () => {
      for (const status of ['declined', 'withdrawn'] as const) {
        const a = allowedActions({ ...base, type: 'INTEREST', direction: 'received', status });
        expect(a).not.toEqual(expect.arrayContaining(['accept']));
        expect(a).not.toContain('decline');
        expect(a).not.toContain('message');
      }
    });
    it('only the sender of a pending interest can withdraw it', () => {
      expect(allowedActions({ ...base, type: 'INTEREST', direction: 'sent', status: 'pending' })).toContain('withdraw');
      expect(allowedActions({ ...base, type: 'INTEREST', direction: 'sent', status: 'accepted' })).not.toContain('withdraw');
    });
    it('connected members can message', () => {
      expect(allowedActions({ type: 'INTEREST', direction: 'received', status: 'accepted', connected: true, interestExists: true }))
        .toContain('message');
    });
    it('a profile view offers "send interest" only when no interest exists either way', () => {
      expect(allowedActions({ type: 'PROFILE_VIEW', direction: 'received', status: null, connected: false, interestExists: false }))
        .toContain('send_interest');
      expect(allowedActions({ type: 'PROFILE_VIEW', direction: 'received', status: null, connected: false, interestExists: true }))
        .not.toContain('send_interest');
    });
  });

  describe('horoscopeBucket (from the report\'s own category)', () => {
    it.each([
      ['Excellent Match', 'excellent'],
      ['Highly Recommended Match', 'excellent'],
      ['Strong Match', 'good'],
      ['Good Match', 'good'],
      ['Moderate Match', 'moderate'],
      ['Requires Further Consideration', 'low'],
    ])('%s → %s', (category, bucket) => expect(horoscopeBucket(category)).toBe(bucket));
    it('no category → undefined', () => expect(horoscopeBucket('')).toBeUndefined());
  });

  describe('bestScore', () => {
    const none: InteractionCompatibility = {
      ai: { score: null, recommended: false },
      horoscope: { status: 'not_analyzed' },
      personality: { available: false, myType: null, partnerType: null },
    };
    it('prefers AI, then personality, then horoscope percentage', () => {
      expect(bestScore({ ...none, ai: { score: 81, recommended: true } })).toBe(81);
      expect(bestScore({ ...none, personality: { available: true, myType: 'INFJ', partnerType: 'ENTJ', score: 92 } })).toBe(92);
      expect(bestScore({ ...none, horoscope: { status: 'analyzed', totalScore: 27, maxScore: 36 } })).toBe(75);
    });
    it('is -1 (sorts last) when nothing is available — never an invented score', () => {
      expect(bestScore(none)).toBe(-1);
    });
  });
});
