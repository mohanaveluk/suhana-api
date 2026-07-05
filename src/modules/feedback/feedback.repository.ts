import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Feedback } from './entity/feedback.entity';
import { FeedbackFilterDto } from './dto/feedback-filter.dto';
import { ApproveFeedbackDto, RejectFeedbackDto } from './dto/approve-reject-feedback.dto';
import { FeedbackStatus } from './enums/feedback-status.enum';
import { FeedbackType } from './enums/feedback-type.enum';

@Injectable()
export class FeedbackRepository {
  constructor(
    @InjectRepository(Feedback)
    private readonly repo: Repository<Feedback>,
  ) {}

  async createFeedback(data: Partial<Feedback>): Promise<Feedback> {
    const feedback = this.repo.create(data);
    return this.repo.save(feedback);
  }

  async getFeedbackById(id: string): Promise<Feedback | null> {
    return this.repo.findOne({
      where: { id, isDeleted: false },
      relations: ['submittedByUser', 'targetUser'],
    });
  }

  async getFeedbackByGuid(guid: string): Promise<Feedback | null> {
    return this.repo.findOne({
      where: { guid, isDeleted: false },
      relations: ['submittedByUser', 'targetUser'],
    });
  }

  async getAllFeedback(filter: FeedbackFilterDto): Promise<[Feedback[], number]> {
    const page = filter.page ?? 1;
    const limit = filter.limit ?? 20;
    const skip = (page - 1) * limit;

    const qb = this.repo
      .createQueryBuilder('f')
      .leftJoinAndSelect('f.submittedByUser', 'su')
      .leftJoinAndSelect('f.targetUser', 'tu')
      .where('f.isDeleted = :isDeleted', { isDeleted: false });

    if (filter.status) qb.andWhere('f.status = :status', { status: filter.status });
    if (filter.category) qb.andWhere('f.category = :category', { category: filter.category });
    if (filter.feedbackType) qb.andWhere('f.feedbackType = :feedbackType', { feedbackType: filter.feedbackType });
    if (filter.rating) qb.andWhere('f.rating = :rating', { rating: filter.rating });
    if (filter.priority) qb.andWhere('f.priority = :priority', { priority: filter.priority });
    if (filter.isPublic !== undefined) qb.andWhere('f.isPublic = :isPublic', { isPublic: filter.isPublic });
    if (filter.fromDate) qb.andWhere('f.createdAt >= :fromDate', { fromDate: new Date(filter.fromDate) });
    if (filter.toDate) qb.andWhere('f.createdAt <= :toDate', { toDate: new Date(filter.toDate) });

    return qb
      .orderBy('f.createdAt', 'DESC')
      .skip(skip)
      .take(limit)
      .getManyAndCount();
  }

  async getFeedbackByUser(userId: string): Promise<Feedback[]> {
    return this.repo.find({
      where: { submittedByUserId: userId, isDeleted: false },
      order: { createdAt: 'DESC' },
    });
  }

  async getFeedbackForUser(targetUserId: string, onlyApproved = false): Promise<Feedback[]> {
    const qb = this.repo
      .createQueryBuilder('f')
      .where('f.targetUserId = :targetUserId', { targetUserId })
      .andWhere('f.isDeleted = :isDeleted', { isDeleted: false });

    if (onlyApproved) {
      qb.andWhere('f.status = :status', { status: FeedbackStatus.APPROVED });
    }

    return qb.orderBy('f.createdAt', 'DESC').getMany();
  }

  async getPublicProfileFeedback(profileId: string): Promise<Feedback[]> {
    return this.repo
      .createQueryBuilder('f')
      .leftJoinAndSelect('f.submittedByUser', 'su')
      .where('f.targetProfileId = :profileId', { profileId })
      .andWhere('f.status = :status', { status: FeedbackStatus.APPROVED })
      .andWhere('f.isPublic = :isPublic', { isPublic: true })
      .andWhere('f.isDeleted = :isDeleted', { isDeleted: false })
      .orderBy('f.createdAt', 'DESC')
      .getMany();
  }

  async approveFeedback(id: string, adminId: string, dto: ApproveFeedbackDto): Promise<Feedback> {
    const feedback = await this.getOrThrow(id);
    feedback.status = FeedbackStatus.APPROVED;
    feedback.isPublic = dto.isPublic ?? false;
    if (dto.adminNotes) feedback.adminNotes = dto.adminNotes;
    feedback.updatedBy = adminId;
    return this.repo.save(feedback);
  }

  async rejectFeedback(id: string, adminId: string, dto: RejectFeedbackDto): Promise<Feedback> {
    const feedback = await this.getOrThrow(id);
    feedback.status = FeedbackStatus.REJECTED;
    feedback.adminNotes = [dto.reason, dto.adminNotes].filter(Boolean).join(' | ') || feedback.adminNotes;
    feedback.updatedBy = adminId;
    return this.repo.save(feedback);
  }

  async resolveFeedback(id: string, adminId: string): Promise<Feedback> {
    const feedback = await this.getOrThrow(id);
    feedback.status = FeedbackStatus.RESOLVED;
    feedback.resolvedBy = adminId;
    feedback.resolvedAt = new Date();
    feedback.updatedBy = adminId;
    return this.repo.save(feedback);
  }

  async addReply(id: string, userId: string, message: string): Promise<Feedback> {
    const feedback = await this.getOrThrow(id);
    feedback.replyMessage = message;
    feedback.repliedByUserId = userId;
    feedback.repliedAt = new Date();
    feedback.updatedBy = userId;
    return this.repo.save(feedback);
  }

  async softDelete(id: string): Promise<void> {
    const feedback = await this.getOrThrow(id);
    feedback.isDeleted = true;
    feedback.deletedAt = new Date();
    await this.repo.save(feedback);
  }

  async getStatistics() {
    const [total, pending, approved, rejected, resolved, totalGeneral, totalProfile] =
      await Promise.all([
        this.repo.count({ where: { isDeleted: false } }),
        this.repo.count({ where: { status: FeedbackStatus.PENDING, isDeleted: false } }),
        this.repo.count({ where: { status: FeedbackStatus.APPROVED, isDeleted: false } }),
        this.repo.count({ where: { status: FeedbackStatus.REJECTED, isDeleted: false } }),
        this.repo.count({ where: { status: FeedbackStatus.RESOLVED, isDeleted: false } }),
        this.repo.count({ where: { feedbackType: FeedbackType.GENERAL, isDeleted: false } }),
        this.repo.count({ where: { feedbackType: FeedbackType.PROFILE, isDeleted: false } }),
      ]);

    const avgResult = await this.repo
      .createQueryBuilder('f')
      .select('AVG(f.rating)', 'avg')
      .where('f.rating IS NOT NULL')
      .andWhere('f.isDeleted = :isDeleted', { isDeleted: false })
      .getRawOne();

    return {
      totalFeedback: total,
      pending,
      approved,
      rejected,
      resolved,
      averageRating: avgResult?.avg ? Math.round(Number(avgResult.avg) * 10) / 10 : 0,
      totalGeneral,
      totalProfile,
    };
  }

  // ---------------------------------------------------------------------------

  private async getOrThrow(id: string): Promise<Feedback> {
    const feedback = await this.repo.findOne({ where: { id, isDeleted: false } });
    if (!feedback) throw new NotFoundException('Feedback record not found');
    return feedback;
  }
}
