import {
  BadRequestException, ForbiddenException, Injectable, NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DeepPartial, Repository } from 'typeorm';

import { MatchFixed } from './entity/match-fixed.entity';
import { CreateMatchFixedDto } from './dto/create-match-fixed.dto';
import { UpdateMatchFixedDto } from './dto/update-match-fixed.dto';
import { PublicStoriesQueryDto } from './dto/public-stories-query.dto';
import { SuccessStoryResponseDto, PaginatedSuccessStoriesDto } from './dto/success-story-response.dto';
import { SuccessStatsResponseDto } from './dto/stats-response.dto';
import { AdminDashboardResponseDto } from './dto/admin-dashboard-response.dto';
import { User, Profile } from '../user/entity';
import { MatchSourceType } from './enums/match-source-type.enum';
import { MatchFixedStatus } from './enums/match-fixed-status.enum';
import { ProfileStatus } from '../user/enums/profile-status.enum';

@Injectable()
export class MatchFixedService {
  constructor(
    @InjectRepository(MatchFixed) private readonly matchFixedRepo: Repository<MatchFixed>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(Profile) private readonly profileRepo: Repository<Profile>,
  ) {}

  // ---------------------------------------------------------------------------
  // Authenticated user APIs
  // ---------------------------------------------------------------------------

  async createMatchFixed(userId: string, dto: CreateMatchFixedDto): Promise<MatchFixed> {
    this.validateSourceRequirements(dto);

    const existing = await this.matchFixedRepo.findOne({
      where: { userId, status: MatchFixedStatus.ACTIVE },
    });
    if (existing) {
      throw new BadRequestException(
        'An active Match Fixed record already exists. Cancel it before creating a new one.',
      );
    }

    if (dto.matchSourceType === MatchSourceType.SUHANA && dto.matchedUserId) {
      const matchedUser = await this.userRepo.findOne({ where: { id: dto.matchedUserId } });
      if (!matchedUser) {
        throw new NotFoundException('The matched user was not found on Suhana');
      }
    }

    const matchFixed = this.matchFixedRepo.create({
      ...dto,
      userId,
      isMatchFromSuhana: dto.matchSourceType === MatchSourceType.SUHANA,
      createdBy: userId,
      updatedBy: userId,
    });

    const saved = await this.matchFixedRepo.save(matchFixed);
    await this.lockProfile(userId);
    return saved;
  }

  async updateMatchFixed(id: string, userId: string, dto: UpdateMatchFixedDto): Promise<MatchFixed> {
    const matchFixed = await this.findOwnedRecord(id, userId);

    if (dto.matchSourceType) {
      const merged = { ...matchFixed, ...dto } as CreateMatchFixedDto;
      this.validateSourceRequirements(merged);
    }

    Object.assign(matchFixed, { ...dto, updatedBy: userId });
    return this.matchFixedRepo.save(matchFixed);
  }

  async getMatchFixed(id: string): Promise<MatchFixed> {
    const matchFixed = await this.matchFixedRepo.findOne({
      where: { id },
      relations: ['user', 'matchedUser'],
    });
    if (!matchFixed) throw new NotFoundException('Match Fixed record not found');
    return matchFixed;
  }

  async getMyMatchFixed(userId: string): Promise<MatchFixed | null> {
    return this.matchFixedRepo.findOne({
      where: { userId, status: MatchFixedStatus.ACTIVE },
      relations: ['matchedUser'],
    });
  }

  async deleteMatchFixed(id: string, userId: string): Promise<{ message: string }> {
    const matchFixed = await this.findOwnedRecord(id, userId);
    matchFixed.status = MatchFixedStatus.CANCELLED;
    matchFixed.updatedBy = userId;
    await this.matchFixedRepo.save(matchFixed);
    return { message: 'Match Fixed record cancelled successfully' };
  }

  // ---------------------------------------------------------------------------
  // Partner verification
  // ---------------------------------------------------------------------------

  async verifyPartner(userId: string, matchFixedId: string): Promise<{ message: string; isVerified: boolean }> {
    const record = await this.matchFixedRepo.findOne({ where: { id: matchFixedId } });

    if (!record) throw new NotFoundException('Match Fixed record not found');
    if (record.status !== MatchFixedStatus.ACTIVE) {
      throw new BadRequestException('This record is no longer active');
    }
    if (record.matchedUserId !== userId) {
      throw new ForbiddenException('Only the matched partner can verify this record');
    }
    if (record.isVerified) {
      throw new BadRequestException('This match has already been verified');
    }

    record.isVerified = true;
    record.verifiedAt = new Date();
    record.verifiedByPartnerId = userId;
    record.updatedBy = userId;

    await this.matchFixedRepo.save(record);

    return {
      message: 'Match verified successfully. Your success story is now marked as Verified!',
      isVerified: true,
    };
  }

  // ---------------------------------------------------------------------------
  // Public display APIs
  // ---------------------------------------------------------------------------

  async getPublicSuccessStories(query: PublicStoriesQueryDto): Promise<PaginatedSuccessStoriesDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 12;
    const skip = (page - 1) * limit;

    const qb = this.matchFixedRepo
      .createQueryBuilder('mf')
      .leftJoinAndSelect('mf.user', 'u')
      .leftJoinAndSelect('u.profile', 'p')
      .leftJoinAndSelect('p.photos', 'photos')
      .leftJoinAndSelect('mf.matchedUser', 'mu')
      .where('mf.allowStoryPublish = :allow', { allow: true })
      .andWhere('mf.status = :status', { status: MatchFixedStatus.ACTIVE })
      .andWhere('mf.successStory IS NOT NULL')
      .orderBy('mf.createdAt', 'DESC');

    if (query.matchSource) {
      qb.andWhere('mf.matchSourceType = :source', { source: query.matchSource });
    }

    const [data, total] = await qb.skip(skip).take(limit).getManyAndCount();

    return {
      data: data.map((mf) => this.toSuccessStoryResponse(mf)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getFeaturedStories(): Promise<SuccessStoryResponseDto[]> {
    const records = await this.matchFixedRepo
      .createQueryBuilder('mf')
      .leftJoinAndSelect('mf.user', 'u')
      .leftJoinAndSelect('u.profile', 'p')
      .leftJoinAndSelect('p.photos', 'photos')
      .leftJoinAndSelect('mf.matchedUser', 'mu')
      .where('mf.allowStoryPublish = :allow', { allow: true })
      .andWhere('mf.status = :status', { status: MatchFixedStatus.ACTIVE })
      .andWhere('mf.successStory IS NOT NULL')
      // Verified stories get priority in the carousel
      .orderBy('mf.isVerified', 'DESC')
      .addOrderBy('mf.createdAt', 'DESC')
      .take(10)
      .getMany();

    return records.map((mf) => this.toSuccessStoryResponse(mf));
  }

  async getSuccessStoryById(id: string): Promise<SuccessStoryResponseDto> {
    const record = await this.matchFixedRepo
      .createQueryBuilder('mf')
      .leftJoinAndSelect('mf.user', 'u')
      .leftJoinAndSelect('u.profile', 'p')
      .leftJoinAndSelect('p.photos', 'photos')
      .leftJoinAndSelect('mf.matchedUser', 'mu')
      .where('mf.id = :id', { id })
      .andWhere('mf.allowStoryPublish = :allow', { allow: true })
      .andWhere('mf.status = :status', { status: MatchFixedStatus.ACTIVE })
      .getOne();

    if (!record) throw new NotFoundException('Success story not found');
    return this.toSuccessStoryResponse(record);
  }

  async getSuccessStats(): Promise<SuccessStatsResponseDto> {
    const [totalMatchFixed, totalMarried, suhanaMatches, verifiedStories] = await Promise.all([
      this.matchFixedRepo.count({ where: { status: MatchFixedStatus.ACTIVE } }),
      this.matchFixedRepo
        .createQueryBuilder('mf')
        .where('mf.status = :status', { status: MatchFixedStatus.ACTIVE })
        .andWhere('mf.marriageDate IS NOT NULL')
        .getCount(),
      this.matchFixedRepo.count({
        where: { status: MatchFixedStatus.ACTIVE, isMatchFromSuhana: true },
      }),
      this.matchFixedRepo.count({
        where: { status: MatchFixedStatus.ACTIVE, isVerified: true },
      }),
    ]);

    return {
      totalMatchFixed,
      totalMarried,
      suhanaMatches,
      externalMatches: totalMatchFixed - suhanaMatches,
      verifiedStories,
    };
  }

  // ---------------------------------------------------------------------------
  // Admin APIs
  // ---------------------------------------------------------------------------

  async getAdminDashboard(): Promise<AdminDashboardResponseDto> {
    const [
      totalMatchesFixed,
      matchesThroughSuhana,
      engagedCount,
      marriedCount,
      verifiedSuccessStories,
      publishedStories,
    ] = await Promise.all([
      this.matchFixedRepo.count({ where: { status: MatchFixedStatus.ACTIVE } }),
      this.matchFixedRepo.count({
        where: { status: MatchFixedStatus.ACTIVE, isMatchFromSuhana: true },
      }),
      this.matchFixedRepo
        .createQueryBuilder('mf')
        .where('mf.status = :status', { status: MatchFixedStatus.ACTIVE })
        .andWhere('mf.engagementDate IS NOT NULL')
        .getCount(),
      this.matchFixedRepo
        .createQueryBuilder('mf')
        .where('mf.status = :status', { status: MatchFixedStatus.ACTIVE })
        .andWhere('mf.marriageDate IS NOT NULL')
        .getCount(),
      this.matchFixedRepo.count({
        where: { status: MatchFixedStatus.ACTIVE, isVerified: true },
      }),
      this.matchFixedRepo.count({
        where: { status: MatchFixedStatus.ACTIVE, allowStoryPublish: true },
      }),
    ]);

    const successRate =
      totalMatchesFixed > 0
        ? Math.round((marriedCount / totalMatchesFixed) * 1000) / 10
        : 0;

    return {
      totalMatchesFixed,
      matchesThroughSuhana,
      matchesOutsideSuhana: totalMatchesFixed - matchesThroughSuhana,
      engagedCount,
      marriedCount,
      successRate,
      verifiedSuccessStories,
      publishedStories,
    };
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private async lockProfile(userId: string): Promise<void> {
    const user = await this.userRepo.findOne({
      where: { id: userId },
      relations: ['profile'],
    });
    if (!user?.profile) return;

    const profile = user.profile;
    profile.profileStatus = ProfileStatus.MATCH_FIXED;
    profile.isSearchable = false;
    profile.acceptNewInterest = false;
    profile.acceptNewChat = false;
    profile.showInFeatured = false;
    await this.profileRepo.save(profile);
  }

  private async findOwnedRecord(id: string, userId: string): Promise<MatchFixed> {
    const matchFixed = await this.matchFixedRepo.findOne({ where: { id } });
    if (!matchFixed) throw new NotFoundException('Match Fixed record not found');
    if (matchFixed.userId !== userId) {
      throw new ForbiddenException('You do not have permission to modify this record');
    }
    if (matchFixed.status === MatchFixedStatus.CANCELLED) {
      throw new BadRequestException('This record has already been cancelled');
    }
    return matchFixed;
  }

  private validateSourceRequirements(dto: CreateMatchFixedDto): void {
    if (dto.matchSourceType === MatchSourceType.SUHANA) {
      if (!dto.matchedUserId && !dto.matchedUserGuid) {
        throw new BadRequestException(
          'matchedUserId or matchedUserGuid is required when matchSourceType is SUHANA',
        );
      }
    } else {
      if (!dto.partnerName) {
        throw new BadRequestException(
          'partnerName is required when matchSourceType is not SUHANA',
        );
      }
    }
  }

  private toSuccessStoryResponse(mf: MatchFixed): SuccessStoryResponseDto {
    const primaryPhoto = mf.user?.profile?.photos?.find((ph) => ph.isPrimary)?.url ?? null;
    const profileImageUrl = mf.user?.profile_image || primaryPhoto;

    const partnerName = mf.isMatchFromSuhana
      ? (mf.matchedUser?.first_name ?? mf.partnerName ?? null)
      : (mf.partnerName ?? null);

    return {
      id: mf.id,
      userName: mf.user?.first_name ?? 'Anonymous',
      partnerName,
      profileImageUrl: profileImageUrl ?? null,
      partnerPhotoUrl: mf.partnerPhotoUrl ?? null,
      engagementPhotoUrl: mf.engagementPhotoUrl ?? null,
      weddingPhotoUrl: mf.weddingPhotoUrl ?? null,
      successStory: mf.successStory ?? null,
      engagementDate: mf.engagementDate ?? null,
      marriageDate: mf.marriageDate ?? null,
      matchSource: mf.matchSourceType,
      isVerified: mf.isVerified,
      verifiedAt: mf.verifiedAt ?? null,
      createdAt: mf.createdAt,
    };
  }
}
