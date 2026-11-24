import { BadRequestException } from '@nestjs/common';
import { EntityManager, In, Repository } from 'typeorm';
import { DiscoverySort } from '../constants/discovery.enums';
import { DiscoveryServiceDetail } from '../entities/discovery-service-detail.entity';
import { DiscoveryCategory } from '../entities/discovery-category.entity';
import { CategorySqlFragment } from '../search/provider-search.query';
import { CategoryAdminInput, CategoryFilters, CategoryHandler } from './category-handler';
import { CategoryDefinition, sanitizeAttributes } from './category-definitions';

/**
 * One handler class for every category defined in CATEGORY_DEFINITIONS.
 * Details live in discovery_service_details (one row per provider+category);
 * category-specific attributes are a typed JSON object (see sanitizeAttributes).
 */
export class ConfigurableCategoryHandler implements CategoryHandler {
  readonly slug: string;
  readonly supportedSorts = Object.values(DiscoverySort);
  private categoryId: number | null = null;

  constructor(
    private readonly def: CategoryDefinition,
    private readonly detailRepo: Repository<DiscoveryServiceDetail>,
    private readonly categoryRepo: Repository<DiscoveryCategory>,
  ) {
    this.slug = def.slug;
  }

  private async resolveCategoryId(manager?: EntityManager): Promise<number | null> {
    if (this.categoryId !== null) return this.categoryId;
    const repo = manager ? manager.getRepository(DiscoveryCategory) : this.categoryRepo;
    const c = await repo.findOne({ where: { slug: this.slug }, select: { id: true } });
    this.categoryId = c?.id ?? null;
    return this.categoryId;
  }

  private assertSpecialties(codes: string[]): void {
    const unknown = codes.filter((c) => !this.def.specialties.includes(c));
    if (unknown.length) throw new BadRequestException(`Unknown specialty for ${this.slug}: ${unknown.join(', ')}`);
  }

  searchFragment(filters: CategoryFilters): CategorySqlFragment {
    const where: string[] = [];
    const whereParams: unknown[] = [];
    const specs = filters.specialization ?? [];
    this.assertSpecialties(specs);
    if (specs.length) {
      where.push(`(${specs.map(() => 'JSON_CONTAINS(sd.specialties, JSON_QUOTE(?))').join(' OR ')})`);
      whereParams.push(...specs);
    }
    if (filters.minExperience !== undefined && filters.minExperience !== null) {
      where.push('sd.experience_years >= ?');
      whereParams.push(filters.minExperience);
    }
    if (filters.minCapacity !== undefined && filters.minCapacity !== null && this.def.capacityAttribute) {
      // Attribute key comes from our own constant list, never from input.
      where.push(`CAST(JSON_UNQUOTE(JSON_EXTRACT(sd.attributes, '$.${this.def.capacityAttribute}')) AS UNSIGNED) >= ?`);
      whereParams.push(filters.minCapacity);
    }
    return {
      // pc is the category join of the engine, so details are for THIS category.
      joins: ['LEFT JOIN discovery_service_details sd ON sd.provider_id = p.id AND sd.category_id = pc.category_id'],
      joinParams: [],
      where,
      whereParams,
      experienceExpr: 'MAX(sd.experience_years)',
    };
  }

  async loadDetails(providerIds: string[]): Promise<Map<string, unknown>> {
    if (!providerIds.length) return new Map();
    const categoryId = await this.resolveCategoryId();
    if (categoryId === null) return new Map();
    const rows = await this.detailRepo.find({ where: { providerId: In(providerIds), categoryId } });
    return new Map(rows.map((r) => [r.providerId, r]));
  }

  toCardExtras(detail: unknown) {
    const d = detail as DiscoveryServiceDetail | undefined;
    return {
      details: {
        experienceYears: d?.experienceYears ?? null,
        specialties: d?.specialties ?? [],
        attributes: d?.attributes ?? {},
      },
    };
  }

  toDetailExtras(detail: unknown) {
    const d = detail as DiscoveryServiceDetail | undefined;
    return {
      serviceDetail: {
        experienceYears: d?.experienceYears ?? null,
        specialties: d?.specialties ?? [],
        attributes: d?.attributes ?? {},
        businessHours: d?.businessHours ?? [],
        certifications: (d?.certifications ?? []).map((c) => ({
          name: c.name, issuer: c.issuer ?? null, year: c.year ?? null, verified: c.verified === true,
        })),
        availabilityNote: d?.availabilityNote ?? null,
      },
    };
  }

  toAdminInput(detail: unknown): CategoryAdminInput {
    const d = detail as DiscoveryServiceDetail | undefined;
    if (!d) return {};
    return {
      categoryDetails: [{
        categorySlug: this.slug,
        experienceYears: d.experienceYears,
        specialties: d.specialties ?? [],
        attributes: d.attributes ?? {},
        businessHours: d.businessHours ?? [],
        certifications: (d.certifications ?? []).map((c) => ({ ...c, verified: c.verified === true })),
        availabilityNote: d.availabilityNote,
      }],
    };
  }

  async saveDetails(manager: EntityManager, providerId: string, input: CategoryAdminInput): Promise<void> {
    const entry = input.categoryDetails?.find((c) => c.categorySlug === this.slug);
    if (!entry) return;
    const categoryId = await this.resolveCategoryId(manager);
    if (categoryId === null) throw new BadRequestException(`Unknown category: ${this.slug}`);
    if (entry.specialties) this.assertSpecialties(entry.specialties);

    const repo = manager.getRepository(DiscoveryServiceDetail);
    const row = (await repo.findOne({ where: { providerId, categoryId } })) ?? repo.create({ providerId, categoryId });
    if (entry.experienceYears !== undefined) row.experienceYears = entry.experienceYears;
    if (entry.specialties !== undefined) row.specialties = Array.from(new Set(entry.specialties));
    if (entry.attributes !== undefined) row.attributes = sanitizeAttributes(this.def, entry.attributes);
    if (entry.businessHours !== undefined) {
      row.businessHours = entry.businessHours.map((h) => ({ day: h.day, open: h.open, close: h.close }));
    }
    if (entry.certifications !== undefined) {
      row.certifications = entry.certifications.map((c) => ({
        name: c.name, issuer: c.issuer ?? null, year: c.year ?? null, verified: c.verified === true,
      }));
    }
    if (entry.availabilityNote !== undefined) row.availabilityNote = entry.availabilityNote;
    await repo.save(row);
  }
}
