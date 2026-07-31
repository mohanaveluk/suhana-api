import { Injectable, NotFoundException } from '@nestjs/common';
import { SuccessStoryRepository } from '../repositories/success-story.repository';
import { CreateSuccessStoryDto } from '../dto/success-story.dto';
import { SuccessStory } from '../entity/success-story.entity';
import {
  MarriageVerificationStatus,
  SuccessStoryStatus,
} from '../enums/testimonial.enums';
import { PaginatedResult } from 'src/common/dto/pagination.dto';
import { AuditEmitter } from '../../audit/audit.emitter';
import { AuditEventType } from '../../audit/enums/audit-event-type.enum';
import { AuditEntityType } from '../../audit/enums/audit-entity-type.enum';

@Injectable()
export class SuccessStoriesService {
  constructor(
    private readonly storyRepo: SuccessStoryRepository,
    private readonly audit: AuditEmitter,
  ) {}

  // BR8: success stories require admin approval → created as PENDING.
  async create(userId: string, dto: CreateSuccessStoryDto): Promise<SuccessStory> {
    const hasVerificationDocs =
      !!dto.weddingPhotoUrl || !!dto.weddingInvitationUrl || !!dto.marriageCertificateUrl;

    const story = this.storyRepo.create({
      groomName: dto.groomName,
      brideName: dto.brideName,
      groomProfileId: dto.groomProfileId ?? null,
      brideProfileId: dto.brideProfileId ?? null,
      title: dto.title,
      story: dto.story,
      engagementDate: dto.engagementDate ? new Date(dto.engagementDate) : null,
      marriageDate: dto.marriageDate ? new Date(dto.marriageDate) : null,
      photoUrl: dto.photoUrl ?? null,
      galleryUrls: dto.galleryUrls ?? null,
      location: dto.location ?? null,
      weddingPhotoUrl: dto.weddingPhotoUrl ?? null,
      weddingInvitationUrl: dto.weddingInvitationUrl ?? null,
      marriageCertificateUrl: dto.marriageCertificateUrl ?? null,
      // If docs were supplied, the badge enters the verification queue.
      marriageVerificationStatus: MarriageVerificationStatus.PENDING,
      verifiedMarriage: false,
      status: SuccessStoryStatus.PENDING,
      createdBy: userId,
    });

    const saved = await this.storyRepo.save(story);

    this.audit.emit({
      eventType: AuditEventType.SUCCESS_STORY_CREATED,
      entityType: AuditEntityType.SUCCESS_STORY,
      entityId: saved.id,
      userId,
      description: 'Success story submitted',
      newValue: { title: saved.title, hasVerificationDocs },
    });

    return saved;
  }

  async listPublic(verifiedOnly: boolean, page: number, limit: number): Promise<PaginatedResult<any>> {
    const [items, total] = await this.storyRepo.findPublic(verifiedOnly, (page - 1) * limit, limit);
    return new PaginatedResult(items.map((s) => this.toPublic(s)), total, page, limit);
  }

  async getFeatured(): Promise<any[]> {
    const items = await this.storyRepo.findFeatured();
    return items.map((s) => this.toPublic(s));
  }

  async getDetail(id: string): Promise<any> {
    const story = await this.storyRepo.findById(id);
    if (!story || story.status !== SuccessStoryStatus.APPROVED) {
      throw new NotFoundException('Success story not found');
    }
    return this.toPublic(story);
  }

  // Public shape hides internal verification documents but exposes the badge.
  private toPublic(s: SuccessStory) {
    return {
      id: s.id,
      groomName: s.groomName,
      brideName: s.brideName,
      title: s.title,
      story: s.story,
      engagementDate: s.engagementDate,
      marriageDate: s.marriageDate,
      photoUrl: s.photoUrl,
      galleryUrls: s.galleryUrls,
      location: s.location,
      isFeatured: s.isFeatured,
      verifiedMarriage: s.verifiedMarriage,
      badge: s.verifiedMarriage ? 'Verified Success Story' : null,
      createdAt: s.createdAt,
    };
  }
}
