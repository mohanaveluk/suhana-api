import { MatchRankingService } from './match-ranking.service';
import { SynonymService } from '../parsers/synonym.service';
import { Profile } from '../../user/entity';
import { SearchIntent } from '../models/search-intent.model';

describe('MatchRankingService', () => {
  const ranking = new MatchRankingService(new SynonymService());

  const profile = (overrides: Partial<Profile> = {}): Profile =>
    ({
      id: 'p1',
      firstName: 'Test',
      occupationTitle: null,
      educationLevel: null,
      city: null,
      state: null,
      country: null,
      religion: null,
      motherTongue: null,
      familyType: null,
      familyValues: null,
      willingToRelocate: false,
      profileCompleteness: 0,
      interests: [],
      lifestyleHabits: [],
      partnerExpectations: [],
      personalityType: null,
      aboutMe: null,
      horoscope: null,
      ...overrides,
    }) as unknown as Profile;

  describe('score normalisation', () => {
    it('awards a near-perfect score when the only expressed facet matches fully', () => {
      const intent: SearchIntent = { profession: 'Doctor' };
      const result = ranking.score(profile({ occupationTitle: 'Doctor' }), intent);

      // A single expressed dimension is renormalised to the full 0-100 range,
      // so matching it must not be capped at its raw 25% weight.
      expect(result.score).toBeGreaterThanOrEqual(98);
    });

    it('scores zero-ish when the only expressed facet does not match', () => {
      const intent: SearchIntent = { profession: 'Doctor' };
      const result = ranking.score(profile({ occupationTitle: 'Plumber' }), intent);

      expect(result.score).toBeLessThan(5);
    });

    it('never exceeds 100', () => {
      const intent: SearchIntent = {
        profession: 'Doctor', state: 'Texas', education: 'Masters',
        familyValues: 'traditional', personalityTraits: ['caring'], horoscopeRequired: true,
      };
      const result = ranking.score(
        profile({
          occupationTitle: 'Doctor', state: 'Texas', educationLevel: 'Masters',
          familyValues: 'traditional', partnerExpectations: ['caring'],
          profileCompleteness: 100,
          horoscope: { rashi: 'Mesha', nakshatra: 'Ashwini', dateOfBirth: new Date(), timeOfBirth: '10:00', placeOfBirth: 'Chennai' },
        }),
        intent,
      );

      expect(result.score).toBeLessThanOrEqual(100);
    });

    it('falls back to profile completeness when nothing was asked for', () => {
      const result = ranking.score(profile({ profileCompleteness: 75 }), {});
      expect(result.score).toBe(75);
      expect(result.breakdown).toHaveProperty('profileCompleteness');
    });
  });

  describe('profession scoring', () => {
    it('matches through a synonym', () => {
      const result = ranking.score(
        profile({ occupationTitle: 'Physician' }), { profession: 'Doctor' },
      );
      expect(result.score).toBeGreaterThan(80);
    });

    it('rates an exact canonical hit above a synonym hit', () => {
      const exact = ranking.score(profile({ occupationTitle: 'Doctor' }), { profession: 'Doctor' });
      const synonym = ranking.score(profile({ occupationTitle: 'Surgeon' }), { profession: 'Doctor' });
      expect(exact.score).toBeGreaterThan(synonym.score);
    });
  });

  describe('education scoring', () => {
    it('treats exceeding the requested level as a full match, not a penalty', () => {
      const intent: SearchIntent = { education: 'Bachelors' };
      const masters = ranking.score(profile({ educationLevel: 'Masters' }), intent);
      const exact = ranking.score(profile({ educationLevel: 'Bachelors' }), intent);

      expect(masters.score).toBe(exact.score);
    });

    it('gives partial credit below the requested level, decaying with distance', () => {
      const intent: SearchIntent = { education: 'Doctorate' };
      const masters = ranking.score(profile({ educationLevel: 'Masters' }), intent);
      const highSchool = ranking.score(profile({ educationLevel: 'High School' }), intent);

      expect(masters.score).toBeGreaterThan(highSchool.score);
    });
  });

  describe('location scoring', () => {
    it('ranks a city match above a state match', () => {
      const intent: SearchIntent = { city: 'Dallas', state: 'Texas' };
      const inCity = ranking.score(profile({ city: 'Dallas', state: 'Texas' }), intent);
      const inState = ranking.score(profile({ city: 'Austin', state: 'Texas' }), intent);

      expect(inCity.score).toBeGreaterThan(inState.score);
    });

    it('gives partial credit to someone willing to relocate', () => {
      const intent: SearchIntent = { state: 'Texas' };
      const relocating = ranking.score(
        profile({ state: 'Ohio', willingToRelocate: true }), intent,
      );
      const staying = ranking.score(
        profile({ state: 'Ohio', willingToRelocate: false }), intent,
      );

      expect(relocating.score).toBeGreaterThan(staying.score);
    });
  });

  describe('personality scoring', () => {
    it('scores proportionally to how many requested traits are present', () => {
      const intent: SearchIntent = { personalityTraits: ['caring', 'ambitious'] };

      const both = ranking.score(
        profile({ partnerExpectations: ['caring', 'ambitious'] }), intent,
      );
      const one = ranking.score(profile({ partnerExpectations: ['caring'] }), intent);
      const none = ranking.score(profile({ partnerExpectations: ['calm'] }), intent);

      expect(both.score).toBeGreaterThan(one.score);
      expect(one.score).toBeGreaterThan(none.score);
    });

    it('finds traits recorded in aboutMe as well as structured fields', () => {
      const result = ranking.score(
        profile({ aboutMe: 'I am a very caring and family oriented person' }),
        { personalityTraits: ['caring'] },
      );
      expect(result.score).toBeGreaterThan(80);
    });
  });

  describe('output shape', () => {
    it('explains why a profile matched', () => {
      const result = ranking.score(
        profile({ occupationTitle: 'Doctor', state: 'Texas' }),
        { profession: 'Doctor', state: 'Texas' },
      );

      expect(result.reasons.length).toBeGreaterThan(0);
      expect(result.reasons.join(' ')).toMatch(/Doctor/);
    });

    it('always provides a reason, even with no expressed intent', () => {
      const result = ranking.score(profile(), {});
      expect(result.reasons.length).toBeGreaterThan(0);
    });

    it('sorts results by descending score', () => {
      const intent: SearchIntent = { profession: 'Doctor' };
      const ranked = ranking.rank(
        [
          profile({ id: 'a', occupationTitle: 'Teacher' }),
          profile({ id: 'b', occupationTitle: 'Doctor' }),
          profile({ id: 'c', occupationTitle: 'Physician' }),
        ],
        intent,
      );

      expect(ranked[0].profile.id).toBe('b');
      expect(ranked.map((r) => r.score)).toEqual(
        [...ranked.map((r) => r.score)].sort((a, b) => b - a),
      );
    });

    it('reports a per-dimension breakdown', () => {
      const result = ranking.score(
        profile({ occupationTitle: 'Doctor', state: 'Texas' }),
        { profession: 'Doctor', state: 'Texas' },
      );

      expect(result.breakdown).toHaveProperty('profession');
      expect(result.breakdown).toHaveProperty('location');
    });
  });

  describe('robustness', () => {
    it('handles a completely empty profile without throwing', () => {
      expect(() =>
        ranking.score(profile(), { profession: 'Doctor', state: 'Texas', personalityTraits: ['caring'] }),
      ).not.toThrow();
    });

    it('handles null array fields', () => {
      const bare = profile({
        interests: null as any,
        lifestyleHabits: null as any,
        partnerExpectations: null as any,
      });
      expect(() => ranking.score(bare, { personalityTraits: ['caring'] })).not.toThrow();
    });
  });
});
