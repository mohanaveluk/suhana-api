import { BadRequestException } from '@nestjs/common';
import { ConfigurableCategoryHandler } from './configurable-category.handler';
import { CATEGORY_DEFINITIONS, sanitizeAttributes } from './category-definitions';
import { CategoryHandlerRegistry } from './category-handler.registry';
import { AstrologerCategoryHandler } from './astrologer-category.handler';
import { GenericCategoryHandler } from './generic-category.handler';
import { buildProviderSearchSql } from '../search/provider-search.query';
import { DiscoverySort } from '../constants/discovery.enums';

const def = (slug: string) => CATEGORY_DEFINITIONS.find((d) => d.slug === slug)!;

describe('ConfigurableCategoryHandler', () => {
  let detailRepo: any;
  let categoryRepo: any;
  const halls = () => new ConfigurableCategoryHandler(def('marriage-hall'), detailRepo, categoryRepo);

  beforeEach(() => {
    detailRepo = { find: jest.fn().mockResolvedValue([]), findOne: jest.fn().mockResolvedValue(null), create: jest.fn((x) => x), save: jest.fn() };
    categoryRepo = { findOne: jest.fn().mockResolvedValue({ id: 2 }) };
  });

  it('registry covers every category; astrologer keeps its own handler; unknown → generic', () => {
    const reg = new CategoryHandlerRegistry(
      new AstrologerCategoryHandler({} as any), new GenericCategoryHandler(), detailRepo, categoryRepo,
    );
    for (const d of CATEGORY_DEFINITIONS) expect(reg.for(d.slug)).toBeInstanceOf(ConfigurableCategoryHandler);
    expect(reg.for('astrologer')).toBeInstanceOf(AstrologerCategoryHandler);
    expect(reg.for('nope')).toBeInstanceOf(GenericCategoryHandler);
  });

  it('search fragment joins details for the searched category and filters specialties/experience/capacity', () => {
    const f = halls().searchFragment({ specialization: ['open-lawn', 'resort'], minExperience: 5, minCapacity: 500 });
    expect(f.joins[0]).toContain('sd.category_id = pc.category_id');
    expect(f.where.join(' ')).toContain("JSON_EXTRACT(sd.attributes, '$.capacityMax')");
    expect(f.whereParams).toEqual(['open-lawn', 'resort', 5, 500]);
    // Composes into valid SQL (one value per placeholder).
    const { page } = buildProviderSearchSql({
      categoryId: 2, origin: null, radiusKm: null, country: 'IN', state: null, city: null, languages: [],
      consultationModes: [], minRating: null, minPrice: null, maxPrice: null, verifiedOnly: false, q: null,
      sort: DiscoverySort.EXPERIENCE, page: 1, limit: 10, category: f,
    });
    expect((page.sql.match(/\?/g) ?? []).length).toBe(page.params.length);
    expect(page.sql).toContain('MAX(sd.experience_years) AS experience_years');
  });

  it('capacity filter is ignored for categories without a capacity attribute', () => {
    const planners = new ConfigurableCategoryHandler(def('wedding-planner'), detailRepo, categoryRepo);
    expect(planners.searchFragment({ minCapacity: 500 }).where).toEqual([]);
  });

  it('rejects specialty codes from another category', () => {
    expect(() => halls().searchFragment({ specialization: ['kundli'] })).toThrow(BadRequestException);
  });

  it('saves details for its own category only, with sanitised attributes', async () => {
    const manager = { getRepository: (e: any) => (e.name === 'DiscoveryCategory' ? categoryRepo : detailRepo) };
    await halls().saveDetails(manager as any, 'p1', {
      categoryDetails: [
        { categorySlug: 'photography', specialties: ['candid'] },
        { categorySlug: 'marriage-hall', specialties: ['banquet-hall'], attributes: { capacityMax: '900', parking: 'true', hacked: 'x' } },
      ],
    });
    expect(detailRepo.save).toHaveBeenCalledTimes(1);
    expect(detailRepo.save).toHaveBeenCalledWith(expect.objectContaining({
      providerId: 'p1', categoryId: 2, specialties: ['banquet-hall'], attributes: { capacityMax: 900, parking: true },
    }));
  });

  it('maps details uniformly for cards and detail pages', () => {
    const row = { experienceYears: 9, specialties: ['resort'], attributes: { capacityMax: 300 }, businessHours: [], certifications: [{ name: 'X', verified: 1 }] };
    expect(halls().toCardExtras(row).details).toEqual({ experienceYears: 9, specialties: ['resort'], attributes: { capacityMax: 300 } });
    expect(halls().toDetailExtras(row).serviceDetail?.certifications[0].verified).toBe(false); // only literal true counts
    expect(halls().toCardExtras(undefined).details).toEqual({ experienceYears: null, specialties: [], attributes: {} });
  });
});

describe('sanitizeAttributes', () => {
  it('keeps only schema keys, coerces types, drops out-of-range and empty values', () => {
    expect(sanitizeAttributes(def('marriage-hall'), {
      capacityMin: -5, capacityMax: '1200', parking: 0, airConditioned: '1', unknown: 1, roomsAvailable: '',
    })).toEqual({ capacityMax: 1200, parking: false, airConditioned: true });
    expect(sanitizeAttributes(def('matrimonial-consultant'), { communitiesServed: '  Tamil  ' }))
      .toEqual({ communitiesServed: 'Tamil' });
    expect(sanitizeAttributes(def('photography'), null)).toEqual({});
  });
});
