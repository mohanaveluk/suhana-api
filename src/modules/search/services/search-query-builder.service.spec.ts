/// <reference types="jest" />

import { SearchQueryBuilderService } from './search-query-builder.service';
import { SynonymService } from '../parsers/synonym.service';
import { SearchIntent } from '../models/search-intent.model';

/**
 * These tests assert on the SQL the builder emits rather than on query results,
 * because the defect they guard against is invisible at the row level until
 * production data happens to trip it: a short alias matched as a bare substring
 * silently widens the filter, and the query still "works".
 */
describe('SearchQueryBuilderService', () => {
  const synonyms = new SynonymService();
  const builder = new SearchQueryBuilderService(synonyms);

  /** Minimal SelectQueryBuilder stand-in that records the SQL fragments. */
  const makeQb = () => {
    const clauses: string[] = [];
    const params: Record<string, any> = {};

    const collect = (condition: any, parameters?: any) => {
      if (typeof condition === 'string') clauses.push(condition);
      else if (condition?.whereFactory) condition.whereFactory(inner);
      Object.assign(params, parameters ?? {});
      return inner;
    };

    const inner: any = {
      where: collect,
      andWhere: collect,
      orWhere: collect,
      leftJoinAndSelect: () => inner,
    };

    return { qb: inner, clauses, params };
  };

  const build = (intent: SearchIntent) => {
    const { qb, clauses, params } = makeQb();
    const repo: any = { createQueryBuilder: () => qb };
    builder.build(repo, intent);
    return { sql: clauses.join(' | '), params };
  };

  describe('short-alias matching', () => {
    it('does not match a two-letter alias as a bare substring', () => {
      // "ma" (Masters) as LIKE '%ma%' matches "Diploma"; it must not be emitted.
      const { params } = build({ education: 'Masters' });

      const likeValues = Object.values(params).filter(
        (v): v is string => typeof v === 'string' && v.startsWith('%'),
      );
      for (const value of likeValues) {
        expect(value.replace(/%/g, '').length).toBeGreaterThanOrEqual(4);
      }
    });

    it('matches short aliases on word boundaries via REGEXP', () => {
      const { sql, params } = build({ education: 'Masters' });

      expect(sql).toContain('REGEXP');

      const pattern = Object.values(params).find(
        (v): v is string => typeof v === 'string' && v.startsWith('\\b'),
      );
      expect(pattern).toBeDefined();
      expect(pattern).toMatch(/\\b\(.*\)\\b/);
      // "ma" must be present, but only inside the boundary-anchored group.
      expect(pattern).toContain('ma');
    });

    it('emits the regex that distinguishes "MS" from "Diploma"', () => {
      const { params } = build({ education: 'Masters' });
      const pattern = Object.values(params).find(
        (v): v is string => typeof v === 'string' && v.startsWith('\\b'),
      )!;

      // Reproduce MySQL's ICU word-boundary semantics in JS to prove intent.
      const regex = new RegExp(pattern.replace(/\\\\/g, '\\'), 'i');
      expect(regex.test('MS Computer Science')).toBe(true);
      expect(regex.test('Diploma')).toBe(false);
      expect(regex.test('Pharmacist')).toBe(false);
    });

    it('still uses substring LIKE for long aliases', () => {
      const { params } = build({ profession: 'Software Engineer' });

      const values = Object.values(params).filter((v): v is string => typeof v === 'string');
      expect(values.some((v) => v === '%software engineer%')).toBe(true);
    });

    it('keeps "Chartered Accountant" from matching "Cardiologist"', () => {
      const { params } = build({ profession: 'Chartered Accountant' });
      const pattern = Object.values(params).find(
        (v): v is string => typeof v === 'string' && v.startsWith('\\b'),
      )!;

      const regex = new RegExp(pattern.replace(/\\\\/g, '\\'), 'i');
      expect(regex.test('CA')).toBe(true);
      expect(regex.test('Cardiologist')).toBe(false);
      expect(regex.test('Advocate')).toBe(false);
      expect(regex.test('Educator')).toBe(false);
    });

    it('keeps country "US" from matching "Australia"', () => {
      const { params } = build({ country: 'USA' });
      const pattern = Object.values(params).find(
        (v): v is string => typeof v === 'string' && v.startsWith('\\b'),
      );

      if (pattern) {
        const regex = new RegExp(pattern.replace(/\\\\/g, '\\'), 'i');
        expect(regex.test('Australia')).toBe(false);
      }
    });
  });

  describe('field mapping', () => {
    it('maps intent.profession onto occupationTitle and educationField', () => {
      const { sql } = build({ profession: 'Doctor' });
      expect(sql).toContain('p.occupationTitle');
      expect(sql).toContain('p.educationField');
    });

    it('maps intent.education onto educationLevel', () => {
      const { sql } = build({ education: 'Masters' });
      expect(sql).toContain('p.educationLevel');
    });

    it('maps intent.languages onto motherTongue', () => {
      const { sql } = build({ languages: ['Tamil'] });
      expect(sql).toContain('p.motherTongue');
    });

    it('maps intent.interests onto interests when an interest is the whole query', () => {
      const { sql } = build({ interests: ['travel'] });
      expect(sql).toContain('p.interests');
    });

    it('maps intent.maritalStatus onto marital_status', () => {
      const { sql } = build({ maritalStatus: 'Divorced' });
      expect(sql).toContain('p.marital_status');
    });

    it('admits NULL marital_status only for "Never Married"', () => {
      expect(build({ maritalStatus: 'Never Married' }).sql).toContain('IS NULL');
      expect(build({ maritalStatus: 'Divorced' }).sql).not.toContain('IS NULL');
    });

    it('maps account-level intents onto the user join', () => {
      const premium = build({ premiumOnly: true });
      expect(premium.sql).toContain('u.membership');

      const verified = build({ verifiedOnly: true });
      expect(verified.sql).toContain('u.is_verified');

      const active = build({ activeWithinDays: 7 });
      expect(active.sql).toContain('u.last_active');
    });
  });

  describe('baseline visibility', () => {
    it('always restricts to active, searchable profiles of live accounts', () => {
      const { sql } = build({});
      expect(sql).toContain('p.status');
      expect(sql).toContain('p.is_searchable');
      expect(sql).toContain('u.is_active');
      expect(sql).toContain('u.is_deleted');
    });
  });

  describe('interests widen rather than narrow', () => {
    it('searches every field an interest can be recorded in', () => {
      const { sql } = build({ interests: ['music'] });

      expect(sql).toContain('p.interests');
      expect(sql).toContain('p.lifestyleHabits');
      expect(sql).toContain('p.partnerExpectations');
      expect(sql).toContain('p.aboutMe');
    });

    it('does NOT filter when the query also names a profession', () => {
      // "a doctor who loves music" must return doctors, not nothing. interests
      // are handled by ranking once there is something real to filter on.
      const { sql } = build({ profession: 'Doctor', interests: ['music'] });
      expect(sql).not.toContain('p.interests');
    });

    it('does NOT filter when the query also names a location', () => {
      const { sql } = build({ state: 'Texas', interests: ['travel'] });
      expect(sql).not.toContain('p.interests');
    });

    it('does NOT filter when the query also names an age range', () => {
      const { sql } = build({ ageMin: 25, ageMax: 30, interests: ['travel'] });
      expect(sql).not.toContain('p.interests');
    });

    it('matches an interest through its synonyms', () => {
      const { params } = build({ interests: ['music'] });
      const values = Object.values(params)
        .filter((v): v is string => typeof v === 'string')
        .join(' ')
        .toLowerCase();

      expect(values).toContain('singing');
      expect(values).toContain('carnatic');
    });
  });

  describe('marital status', () => {
    it('accepts every previously-married status for a remarriage search', () => {
      const { sql, params } = build({ openToRemarriage: true });

      expect(sql).toContain('p.marital_status IN');
      const statuses = params.remarriageStatuses as string[];
      expect(statuses).toEqual(
        expect.arrayContaining(['Divorced', 'Widowed', 'Awaiting Divorce', 'Annulled']),
      );
      expect(statuses).not.toContain('Never Married');
    });

    it('prefers openToRemarriage over a specific status', () => {
      const { sql } = build({ openToRemarriage: true, maritalStatus: 'Divorced' });
      expect(sql).toContain('IN');
    });
  });

  describe('soft facets do not filter', () => {
    it('does not add a WHERE clause for personality traits', () => {
      const { sql } = build({ personalityTraits: ['caring'] });
      expect(sql).not.toContain('partnerExpectations');
    });

    it('does not add a WHERE clause for familyValues', () => {
      const { sql } = build({ familyValues: 'traditional' });
      expect(sql).not.toContain('p.familyValues');
    });
  });

  describe('education ladder', () => {
    it('accepts levels above the requested one', () => {
      const { params } = build({ education: 'Bachelors' });
      const values = Object.values(params)
        .filter((v): v is string => typeof v === 'string')
        .join(' ')
        .toLowerCase();

      // Doctorate is above Bachelors, so its aliases must be included.
      expect(values).toContain('doctorate');
    });

    it('excludes levels below the requested one', () => {
      const { params } = build({ education: 'Masters' });
      const values = Object.values(params)
        .filter((v): v is string => typeof v === 'string')
        .join(' ')
        .toLowerCase();

      expect(values).not.toContain('high school');
    });
  });
});
