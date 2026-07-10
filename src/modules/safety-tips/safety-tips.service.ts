import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { SafetyTip } from './entities/safety-tip.entity';
import { SafetyCategory, SAFETY_CATEGORY_LABELS } from './enums/safety-category.enum';
import { CreateSafetyTipDto } from './dto/create-safety-tip.dto';
import { UpdateSafetyTipDto } from './dto/update-safety-tip.dto';
import { QuerySafetyTipsDto, SafetyTipsSortBy } from './dto/query-safety-tips.dto';
import { ReorderSafetyTipsDto } from './dto/reorder-safety-tips.dto';
import {
  PaginatedSafetyTipsResponseDto,
  SafetyCategoryResponseDto,
  SafetyTipResponseDto,
} from './dto/safety-tip-response.dto';

const SORT_COLUMN_MAP: Record<SafetyTipsSortBy, string> = {
  [SafetyTipsSortBy.DISPLAY_ORDER]: 't.displayOrder',
  [SafetyTipsSortBy.VIEW_COUNT]: 't.viewCount',
  [SafetyTipsSortBy.CREATED_AT]: 't.createdAt',
};

@Injectable()
export class SafetyTipsService {
  constructor(
    @InjectRepository(SafetyTip)
    private readonly repo: Repository<SafetyTip>,
  ) {}

  // ── Public ────────────────────────────────────────────────────────────────────

  async findAll(dto: QuerySafetyTipsDto): Promise<PaginatedSafetyTipsResponseDto> {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;
    const skip = (page - 1) * limit;

    const qb = this.repo
      .createQueryBuilder('t')
      .where('t.isPublished = :isPublished', { isPublished: true })
      .andWhere('t.isDeleted = :isDeleted', { isDeleted: false });

    if (dto.category) {
      qb.andWhere('t.category = :category', { category: dto.category });
    }

    if (dto.search) {
      qb.andWhere(
        '(t.title LIKE :q OR t.shortDescription LIKE :q OR t.content LIKE :q)',
        { q: `%${dto.search}%` },
      );
    }

    const sortCol = SORT_COLUMN_MAP[dto.sortBy ?? SafetyTipsSortBy.DISPLAY_ORDER];
    qb.orderBy(sortCol, dto.sortOrder === 'desc' ? 'DESC' : 'ASC');

    const [data, total] = await qb.skip(skip).take(limit).getManyAndCount();

    return {
      data: data.map(t => this.toResponse(t)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findFeatured(): Promise<SafetyTipResponseDto[]> {
    const tips = await this.repo.find({
      where: { isFeatured: true, isPublished: true, isDeleted: false },
      order: { displayOrder: 'ASC' },
    });
    return tips.map(t => this.toResponse(t));
  }

  async getCategories(): Promise<SafetyCategoryResponseDto[]> {
    const counts: { category: string; count: string }[] = await this.repo
      .createQueryBuilder('t')
      .select('t.category', 'category')
      .addSelect('COUNT(*)', 'count')
      .where('t.isPublished = :isPublished', { isPublished: true })
      .andWhere('t.isDeleted = :isDeleted', { isDeleted: false })
      .groupBy('t.category')
      .getRawMany();

    const countMap = new Map(counts.map(c => [c.category, Number(c.count)]));

    return Object.values(SafetyCategory).map(cat => ({
      category: cat,
      label: SAFETY_CATEGORY_LABELS[cat],
      count: countMap.get(cat) ?? 0,
    }));
  }

  async findById(id: string): Promise<SafetyTipResponseDto> {
    const tip = await this.repo.findOne({
      where: { id, isPublished: true, isDeleted: false },
    });
    if (!tip) throw new NotFoundException('Safety tip not found');

    await this.repo.increment({ id }, 'viewCount', 1);
    tip.viewCount += 1;

    return this.toResponse(tip);
  }

  // ── Admin ─────────────────────────────────────────────────────────────────────

  async findAllAdmin(dto: QuerySafetyTipsDto): Promise<PaginatedSafetyTipsResponseDto> {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;
    const skip = (page - 1) * limit;

    const qb = this.repo
      .createQueryBuilder('t')
      .where('t.isDeleted = :isDeleted', { isDeleted: false });

    if (dto.category) {
      qb.andWhere('t.category = :category', { category: dto.category });
    }

    if (dto.search) {
      qb.andWhere(
        '(t.title LIKE :q OR t.shortDescription LIKE :q)',
        { q: `%${dto.search}%` },
      );
    }

    const sortCol = SORT_COLUMN_MAP[dto.sortBy ?? SafetyTipsSortBy.DISPLAY_ORDER];
    qb.orderBy(sortCol, dto.sortOrder === 'desc' ? 'DESC' : 'ASC');

    const [data, total] = await qb.skip(skip).take(limit).getManyAndCount();

    return {
      data: data.map(t => this.toResponse(t)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async create(dto: CreateSafetyTipDto): Promise<SafetyTipResponseDto> {
    const tip = this.repo.create({
      ...dto,
      icon: dto.icon ?? null,
      imageUrl: dto.imageUrl ?? null,
      videoUrl: dto.videoUrl ?? null,
      displayOrder: dto.displayOrder ?? 0,
      isFeatured: dto.isFeatured ?? false,
      isPublished: dto.isPublished ?? false,
    });
    const saved = await this.repo.save(tip);
    return this.toResponse(saved);
  }

  async update(id: string, dto: UpdateSafetyTipDto): Promise<SafetyTipResponseDto> {
    const tip = await this.getOrThrow(id);
    Object.assign(tip, dto);
    const saved = await this.repo.save(tip);
    return this.toResponse(saved);
  }

  async softDelete(id: string): Promise<{ message: string }> {
    const tip = await this.getOrThrow(id);
    tip.isDeleted = true;
    tip.deletedAt = new Date();
    tip.isPublished = false;
    await this.repo.save(tip);
    return { message: 'Safety tip deleted successfully' };
  }

  async togglePublish(id: string): Promise<SafetyTipResponseDto> {
    const tip = await this.getOrThrow(id);
    tip.isPublished = !tip.isPublished;
    const saved = await this.repo.save(tip);
    return this.toResponse(saved);
  }

  async toggleFeature(id: string): Promise<SafetyTipResponseDto> {
    const tip = await this.getOrThrow(id);
    tip.isFeatured = !tip.isFeatured;
    const saved = await this.repo.save(tip);
    return this.toResponse(saved);
  }

  async reorder(dto: ReorderSafetyTipsDto): Promise<{ message: string }> {
    await Promise.all(
      dto.items.map(item => this.repo.update(item.id, { displayOrder: item.displayOrder })),
    );
    return { message: 'Display order updated successfully' };
  }

  // ── Private ───────────────────────────────────────────────────────────────────

  private async getOrThrow(id: string): Promise<SafetyTip> {
    const tip = await this.repo.findOne({ where: { id, isDeleted: false } });
    if (!tip) throw new NotFoundException('Safety tip not found');
    return tip;
  }

  private toResponse(tip: SafetyTip): SafetyTipResponseDto {
    return {
      id: tip.id,
      title: tip.title,
      shortDescription: tip.shortDescription,
      content: tip.content,
      category: tip.category,
      icon: tip.icon,
      imageUrl: tip.imageUrl,
      videoUrl: tip.videoUrl,
      displayOrder: tip.displayOrder,
      isFeatured: tip.isFeatured,
      isPublished: tip.isPublished,
      viewCount: tip.viewCount,
      createdAt: tip.createdAt,
      updatedAt: tip.updatedAt,
    };
  }
}
