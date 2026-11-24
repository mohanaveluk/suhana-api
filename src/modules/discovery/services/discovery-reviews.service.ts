import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { DiscoveryReview } from '../entities/discovery-review.entity';
import { DiscoveryProvider } from '../entities/discovery-provider.entity';
import { DiscoveryReviewStatus } from '../constants/discovery.enums';
import {
  CreateDiscoveryReviewDto, DiscoveryReviewDto, DiscoveryReviewListDto,
} from '../dto/discovery-detail.dto';
import { AdminReviewQueryDto, ModerateReviewDto } from '../dto/discovery-admin.dto';
import { DiscoverySearchService } from './discovery-search.service';
import { AuditEmitter } from '../../audit/audit.emitter';
import { AuditEventType } from '../../audit/enums/audit-event-type.enum';
import { AuditEntityType } from '../../audit/enums/audit-entity-type.enum';

export interface AdminReviewDto extends DiscoveryReviewDto {
  providerId: string;
  providerName: string | null;
  userId: string;
  moderationNote: string | null;
  moderatedAt: Date | null;
}

/**
 * Member reviews of Discover listings.
 *
 * Eligibility (Phase 1): any signed-in member may submit ONE review per
 * listing; every review starts PENDING and is published only after an admin
 * approves it. There is no booking record yet, so reviews are not marked as
 * "verified consultations". Ratings shown anywhere are computed from APPROVED
 * reviews only — nothing is seeded or invented.
 */
@Injectable()
export class DiscoveryReviewsService {
  constructor(
    @InjectRepository(DiscoveryReview) private readonly reviewRepo: Repository<DiscoveryReview>,
    @InjectRepository(DiscoveryProvider) private readonly providerRepo: Repository<DiscoveryProvider>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly search: DiscoverySearchService,
    private readonly auditEmitter: AuditEmitter,
  ) {}

  /** "Priya S." — never the full surname or email. */
  private async authorNames(userIds: string[]): Promise<Map<string, string>> {
    const ids = Array.from(new Set(userIds)).filter(Boolean);
    if (!ids.length) return new Map();
    const rows: Array<{ id: string; first_name: string | null; last_name: string | null }> = await this.dataSource.query(
      `SELECT id, first_name, last_name FROM \`user\` WHERE id IN (${ids.map(() => '?').join(', ')})`,
      ids,
    );
    return new Map(
      rows.map((r) => {
        const first = (r.first_name ?? '').trim() || 'Member';
        const initial = (r.last_name ?? '').trim().charAt(0);
        return [r.id, initial ? `${first} ${initial.toUpperCase()}.` : first];
      }),
    );
  }

  private toDto(r: DiscoveryReview, names: Map<string, string>, userId: string): DiscoveryReviewDto {
    return {
      id: r.id,
      rating: r.rating,
      title: r.title ?? null,
      comment: r.comment,
      authorName: names.get(r.userId) ?? 'Member',
      createdAt: r.createdAt,
      status: r.status,
      isMine: r.userId === userId,
    };
  }

  async list(providerId: string, userId: string, page = 1, limit = 10): Promise<DiscoveryReviewListDto> {
    await this.search.findVisibleProvider(providerId);
    const [rows, total] = await this.reviewRepo.findAndCount({
      where: { providerId, status: DiscoveryReviewStatus.APPROVED },
      order: { createdAt: 'DESC', id: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    const mine = await this.reviewRepo.findOne({ where: { providerId, userId } });
    const names = await this.authorNames([...rows.map((r) => r.userId), ...(mine ? [mine.userId] : [])]);
    return {
      items: rows.map((r) => this.toDto(r, names, userId)),
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      myReview: mine ? this.toDto(mine, names, userId) : null,
    };
  }

  async create(providerId: string, userId: string, dto: CreateDiscoveryReviewDto): Promise<DiscoveryReviewDto> {
    const provider = await this.search.findVisibleProvider(providerId);
    if (provider.userId && provider.userId === userId) {
      throw new ConflictException('You cannot review your own listing.');
    }
    const existing = await this.reviewRepo.findOne({ where: { providerId, userId } });
    if (existing) throw new ConflictException('You have already reviewed this listing.');

    let saved: DiscoveryReview;
    try {
      saved = await this.reviewRepo.save(
        this.reviewRepo.create({
          providerId,
          userId,
          rating: dto.rating,
          title: dto.title?.trim() || null,
          comment: dto.comment.trim(),
          status: DiscoveryReviewStatus.PENDING,
        }),
      );
    } catch (e: any) {
      if (e?.code === 'ER_DUP_ENTRY') throw new ConflictException('You have already reviewed this listing.');
      throw e;
    }
    this.auditEmitter.emit({
      eventType: AuditEventType.DISCOVERY_REVIEW_SUBMITTED,
      entityType: AuditEntityType.DISCOVERY_REVIEW,
      entityId: saved.id,
      userId,
      newValue: { providerId, rating: dto.rating },
      description: 'Discover review submitted for moderation',
    });
    const names = await this.authorNames([userId]);
    return this.toDto(saved, names, userId);
  }

  // ── Admin ───────────────────────────────────────────────────────────────

  async adminList(q: AdminReviewQueryDto) {
    const page = q.page ?? 1;
    const limit = q.limit ?? 20;
    const where: Record<string, unknown> = {};
    if (q.status) where.status = q.status;
    if (q.providerId) where.providerId = q.providerId;
    const [rows, total] = await this.reviewRepo.findAndCount({
      where,
      order: { createdAt: 'DESC', id: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    const names = await this.authorNames(rows.map((r) => r.userId));
    const providerIds = Array.from(new Set(rows.map((r) => r.providerId)));
    const providers = providerIds.length
      ? await this.providerRepo.find({ where: { id: In(providerIds) }, withDeleted: true, select: { id: true, displayName: true } })
      : [];
    const pname = new Map(providers.map((p) => [p.id, p.displayName]));
    const items: AdminReviewDto[] = rows.map((r) => ({
      ...this.toDto(r, names, ''),
      providerId: r.providerId,
      providerName: pname.get(r.providerId) ?? null,
      userId: r.userId,
      moderationNote: r.moderationNote ?? null,
      moderatedAt: r.moderatedAt ?? null,
    }));
    return { items, total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) };
  }

  async moderate(id: string, dto: ModerateReviewDto, adminId: string): Promise<{ id: string; status: DiscoveryReviewStatus }> {
    const review = await this.reviewRepo.findOne({ where: { id } });
    if (!review) throw new NotFoundException('Review not found');
    const before = review.status;
    review.status = dto.status;
    review.moderationNote = dto.note ?? review.moderationNote ?? null;
    review.moderatedBy = adminId;
    review.moderatedAt = new Date();
    await this.reviewRepo.save(review);
    await this.recomputeRating(review.providerId);
    this.auditEmitter.emit({
      eventType: AuditEventType.DISCOVERY_REVIEW_MODERATED,
      entityType: AuditEntityType.DISCOVERY_REVIEW,
      entityId: id,
      userId: adminId,
      oldValue: { status: before },
      newValue: { status: dto.status, note: dto.note ?? null },
      description: `Discover review ${before} → ${dto.status}`,
    });
    return { id, status: review.status };
  }

  /** rating_avg / rating_count = APPROVED reviews only. */
  async recomputeRating(providerId: string): Promise<void> {
    const row: { avg: string | null; n: string | number } | undefined = await this.reviewRepo
      .createQueryBuilder('r')
      .select('AVG(r.rating)', 'avg')
      .addSelect('COUNT(*)', 'n')
      .where('r.provider_id = :providerId AND r.status = :status', { providerId, status: DiscoveryReviewStatus.APPROVED })
      .getRawOne();
    const count = Number(row?.n ?? 0);
    await this.providerRepo.update(
      { id: providerId },
      { ratingCount: count, ratingAvg: count > 0 ? Math.round(Number(row?.avg) * 100) / 100 : null },
    );
  }
}
