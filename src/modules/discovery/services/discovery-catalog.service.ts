import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DiscoveryCategory } from '../entities/discovery-category.entity';
import { CategoryDto } from '../dto/discovery-detail.dto';
import { UpdateCategoryDto } from '../dto/discovery-admin.dto';
import { AuditEmitter } from '../../audit/audit.emitter';
import { AuditEventType } from '../../audit/enums/audit-event-type.enum';
import { AuditEntityType } from '../../audit/enums/audit-entity-type.enum';

export class CategoryComingSoonException extends NotFoundException {
  constructor(name: string) {
    super({ statusCode: 404, message: `${name} is coming soon to Aurora Discover.`, error: 'Not Found', code: 'CATEGORY_COMING_SOON' });
  }
}

@Injectable()
export class DiscoveryCatalogService {
  constructor(
    @InjectRepository(DiscoveryCategory) private readonly categoryRepo: Repository<DiscoveryCategory>,
    private readonly auditEmitter: AuditEmitter,
  ) {}

  toDto(c: DiscoveryCategory): CategoryDto {
    return {
      id: c.id,
      slug: c.slug,
      name: c.name,
      description: c.description ?? null,
      kind: c.kind,
      icon: c.icon ?? null,
      imageUrl: c.imageUrl ?? null,
      isActive: c.isActive,
      displayOrder: c.displayOrder,
    };
  }

  async listCategories(): Promise<CategoryDto[]> {
    const rows = await this.categoryRepo.find({ order: { displayOrder: 'ASC', name: 'ASC' } });
    return rows.map((c) => this.toDto(c));
  }

  async getCategory(slug: string): Promise<CategoryDto> {
    const c = await this.categoryRepo.findOne({ where: { slug } });
    if (!c) throw new NotFoundException('Category not found');
    return this.toDto(c);
  }

  /** For searches: the category must exist AND be active. */
  async requireActiveCategory(slug: string): Promise<DiscoveryCategory> {
    const c = await this.categoryRepo.findOne({ where: { slug } });
    if (!c) throw new NotFoundException('Category not found');
    if (!c.isActive) throw new CategoryComingSoonException(c.name);
    return c;
  }

  async findBySlugs(slugs: string[]): Promise<DiscoveryCategory[]> {
    if (!slugs.length) return [];
    return this.categoryRepo.createQueryBuilder('c').where('c.slug IN (:...slugs)', { slugs }).getMany();
  }

  async updateCategory(id: number, dto: UpdateCategoryDto, adminId: string): Promise<CategoryDto> {
    const c = await this.categoryRepo.findOne({ where: { id } });
    if (!c) throw new NotFoundException('Category not found');
    const before = this.toDto(c);
    if (dto.name !== undefined) c.name = dto.name;
    if (dto.description !== undefined) c.description = dto.description;
    if (dto.isActive !== undefined) c.isActive = dto.isActive;
    if (dto.displayOrder !== undefined) c.displayOrder = dto.displayOrder;
    if (dto.icon !== undefined) c.icon = dto.icon;
    if (dto.imageUrl !== undefined) c.imageUrl = dto.imageUrl;
    const saved = this.toDto(await this.categoryRepo.save(c));
    this.auditEmitter.emit({
      eventType: AuditEventType.DISCOVERY_CATEGORY_UPDATED,
      entityType: AuditEntityType.DISCOVERY_CATEGORY,
      entityId: String(id),
      userId: adminId,
      oldValue: before as unknown as Record<string, unknown>,
      newValue: saved as unknown as Record<string, unknown>,
      description: `Discover category "${c.slug}" updated`,
    });
    return saved;
  }
}
