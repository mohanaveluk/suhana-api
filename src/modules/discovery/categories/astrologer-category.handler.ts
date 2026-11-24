import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, Repository } from 'typeorm';
import { ASTROLOGER_SPECIALIZATIONS, CATEGORY_SLUGS } from '../constants/discovery.constants';
import { DiscoverySort } from '../constants/discovery.enums';
import { DiscoveryAstrologerDetail } from '../entities/discovery-astrologer-detail.entity';
import { CategoryAdminInput, CategoryFilters, CategoryHandler } from './category-handler';
import { CategorySqlFragment } from '../search/provider-search.query';

@Injectable()
export class AstrologerCategoryHandler implements CategoryHandler {
  readonly slug = CATEGORY_SLUGS.ASTROLOGER;
  readonly supportedSorts = Object.values(DiscoverySort);

  constructor(
    @InjectRepository(DiscoveryAstrologerDetail)
    private readonly detailRepo: Repository<DiscoveryAstrologerDetail>,
  ) {}

  searchFragment(filters: CategoryFilters): CategorySqlFragment {
    const where: string[] = [];
    const whereParams: unknown[] = [];
    const specs = filters.specialization ?? [];
    const unknown = specs.filter((x) => !(ASTROLOGER_SPECIALIZATIONS as readonly string[]).includes(x));
    if (unknown.length) throw new BadRequestException(`Unknown specialization: ${unknown.join(', ')}`);
    if (specs.length) {
      // Any of the selected specializations.
      where.push(`(${specs.map(() => 'JSON_CONTAINS(ad.specializations, JSON_QUOTE(?))').join(' OR ')})`);
      whereParams.push(...specs);
    }
    if (filters.minExperience !== undefined && filters.minExperience !== null) {
      where.push('ad.experience_years >= ?');
      whereParams.push(filters.minExperience);
    }
    return {
      joins: ['LEFT JOIN discovery_astrologer_details ad ON ad.provider_id = p.id'],
      joinParams: [],
      where,
      whereParams,
      experienceExpr: 'MAX(ad.experience_years)',
    };
  }

  async loadDetails(providerIds: string[]): Promise<Map<string, unknown>> {
    if (!providerIds.length) return new Map();
    const rows = await this.detailRepo.find({ where: { providerId: In(providerIds) } });
    return new Map(rows.map((r) => [r.providerId, r]));
  }

  toCardExtras(detail: unknown) {
    const d = detail as DiscoveryAstrologerDetail | undefined;
    return {
      astrologer: {
        experienceYears: d?.experienceYears ?? null,
        specializations: d?.specializations ?? [],
      },
      details: {
        experienceYears: d?.experienceYears ?? null,
        specialties: d?.specializations ?? [],
        attributes: {},
      },
    };
  }

  toDetailExtras(detail: unknown) {
    const d = detail as DiscoveryAstrologerDetail | undefined;
    const certifications = (d?.certifications ?? []).map((c) => ({
      name: c.name, issuer: c.issuer ?? null, year: c.year ?? null, verified: c.verified === true,
    }));
    return {
      serviceDetail: {
        experienceYears: d?.experienceYears ?? null,
        specialties: d?.specializations ?? [],
        attributes: {},
        businessHours: d?.businessHours ?? [],
        certifications,
        availabilityNote: d?.availabilityNote ?? null,
      },
      astrologerDetail: {
        experienceYears: d?.experienceYears ?? null,
        specializations: d?.specializations ?? [],
        businessHours: d?.businessHours ?? [],
        certifications: (d?.certifications ?? []).map((c) => ({
          name: c.name,
          issuer: c.issuer ?? null,
          year: c.year ?? null,
          verified: c.verified === true,
        })),
        availabilityNote: d?.availabilityNote ?? null,
      },
    };
  }

  toAdminInput(detail: unknown): CategoryAdminInput {
    const d = detail as DiscoveryAstrologerDetail | undefined;
    if (!d) return { astrologer: undefined };
    return {
      astrologer: {
        experienceYears: d.experienceYears,
        specializations: d.specializations ?? [],
        businessHours: d.businessHours ?? [],
        certifications: (d.certifications ?? []).map((c) => ({ ...c, verified: c.verified === true })),
        availabilityNote: d.availabilityNote,
      },
    };
  }

  async saveDetails(manager: EntityManager, providerId: string, input: CategoryAdminInput): Promise<void> {
    const a = input.astrologer;
    if (!a) return;
    const repo = manager.getRepository(DiscoveryAstrologerDetail);
    const existing = await repo.findOne({ where: { providerId } });
    const row = existing ?? repo.create({ providerId });
    if (a.experienceYears !== undefined) row.experienceYears = a.experienceYears;
    if (a.specializations !== undefined) row.specializations = Array.from(new Set(a.specializations));
    if (a.businessHours !== undefined) {
      row.businessHours = a.businessHours.map((h) => ({ day: h.day, open: h.open, close: h.close }));
    }
    if (a.certifications !== undefined) {
      row.certifications = a.certifications.map((c) => ({
        name: c.name,
        issuer: c.issuer ?? null,
        year: c.year ?? null,
        verified: c.verified === true,
      }));
    }
    if (a.availabilityNote !== undefined) row.availabilityNote = a.availabilityNote;
    await repo.save(row);
  }
}
