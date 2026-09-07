import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';

import { ProfileVisit } from './entities/profile-visit.entity';
import { Match, Profile } from '../user/entity';
import { CustomLoggerService } from '../logger/custom-logger.service';
import { ProfileVisitsQueryDto } from './dto/profile-visits-query.dto';
import {
  PaginatedRecentVisitsResponseDto, RecentVisitResponseDto,
} from './dto/recent-visit-response.dto';
import {
  ProfileVisitHistoryResponseDto, ProfileVisitMutationResponseDto, VisitStatsResponseDto,
} from './dto/visit-analytics-response.dto';

@Injectable()
export class ProfileVisitsService {
  private readonly ctx = ProfileVisitsService.name;

  constructor(
    @InjectRepository(ProfileVisit) private readonly visitRepo: Repository<ProfileVisit>,
    @InjectRepository(Profile) private readonly profileRepo: Repository<Profile>,
    @InjectRepository(Match) private readonly matchRepo: Repository<Match>,
    private readonly logger: CustomLoggerService,
  ) {}

  // ─── Recording ─────────────────────────────────────────────────────────────

  /**
   * Records that `visitorUserId` viewed `profileId`.
   *
   * - No-op for a guest, a missing profile, or a member viewing their own profile.
   * - One row per (visitor, profile): a repeat visit bumps `visitCount` and
   *   `lastVisitedAt` and revives a soft-deleted row.
   * - Best-effort: any failure is logged and swallowed so it can never break
   *   the profile fetch it hangs off.
   */
  async recordVisit(visitorUserId: string | undefined | null, profileId: string): Promise<void> {
    if (!visitorUserId || !profileId) return;

    try {
      const profile = await this.profileRepo.findOne({
        where: { id: profileId },
        relations: ['user'],
      });
      if (!profile?.user?.id) return;          // unknown / orphaned profile
      if (profile.user.id === visitorUserId) return; // self-visit

      // Atomic upsert — avoids a read-modify-write race between two rapid views.
      await this.visitRepo.query(
        `INSERT INTO \`profile_visits\`
           (\`id\`, \`visitor_user_id\`, \`visited_profile_id\`, \`visited_user_id\`,
            \`visit_count\`, \`first_visited_at\`, \`last_visited_at\`,
            \`is_deleted\`, \`deleted_at\`, \`created_at\`, \`updated_at\`)
         VALUES (?, ?, ?, ?, 1, NOW(), NOW(), 0, NULL, NOW(), NOW())
         ON DUPLICATE KEY UPDATE
           \`visit_count\`     = \`visit_count\` + 1,
           \`last_visited_at\` = NOW(),
           \`is_deleted\`      = 0,
           \`deleted_at\`      = NULL,
           \`updated_at\`      = NOW()`,
        [uuidv4(), visitorUserId, profile.id, profile.user.id],
      );
    } catch (err) {
      this.logger.error(
        `recordVisit failed (visitor=${visitorUserId}, profile=${profileId}): ${err instanceof Error ? err.message : String(err)}`,
        this.ctx,
      );
    }
  }

  // ─── Reads ─────────────────────────────────────────────────────────────────

  /** Recently visited profiles, most recent first. */
  getRecentVisits(
    visitorUserId: string,
    query: ProfileVisitsQueryDto,
  ): Promise<PaginatedRecentVisitsResponseDto> {
    return this.listVisits(visitorUserId, query, 'recent');
  }

  /** Frequently visited profiles, highest visit count first. */
  getFrequentVisits(
    visitorUserId: string,
    query: ProfileVisitsQueryDto,
  ): Promise<PaginatedRecentVisitsResponseDto> {
    return this.listVisits(visitorUserId, query, 'frequent');
  }

  private async listVisits(
    visitorUserId: string,
    query: ProfileVisitsQueryDto,
    order: 'recent' | 'frequent',
  ): Promise<PaginatedRecentVisitsResponseDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const qb = this.visitRepo
      .createQueryBuilder('visit')
      .leftJoinAndSelect('visit.visitedProfile', 'p')
      .leftJoinAndSelect('p.photos', 'photos')
      .leftJoinAndSelect('p.user', 'u')
      .where('visit.visitorUserId = :visitorUserId', { visitorUserId })
      .andWhere('visit.isDeleted = 0')
      .skip((page - 1) * limit)
      .take(limit);

    if (order === 'frequent') {
      qb.orderBy('visit.visitCount', 'DESC').addOrderBy('visit.lastVisitedAt', 'DESC');
    } else {
      qb.orderBy('visit.lastVisitedAt', 'DESC');
    }

    const [visits, total] = await qb.getManyAndCount();

    // Resolve match status in one extra query rather than a per-row join.
    const visitedUserIds = visits.map((v) => v.visitedUserId).filter(Boolean);
    const statusByUserId = new Map<string, string>();
    if (visitedUserIds.length) {
      const matches = await this.matchRepo
        .createQueryBuilder('m')
        .select(['m.matchedUserId', 'm.status'])
        .where('m.userId = :visitorUserId', { visitorUserId })
        .andWhere('m.matchedUserId IN (:...visitedUserIds)', { visitedUserIds })
        .getMany();
      for (const m of matches) statusByUserId.set(m.matchedUserId, m.status);
    }

    return {
      data: visits.map((v) => this.toRecentVisitDto(v, statusByUserId.get(v.visitedUserId) ?? null)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 0,
    };
  }

  /** Admin: aggregate visit stats for a single profile. */
  async getProfileVisitHistory(profileId: string): Promise<ProfileVisitHistoryResponseDto> {
    const profileExists = await this.profileRepo.count({ where: { id: profileId } });
    if (!profileExists) throw new NotFoundException('Profile not found');

    const [row] = await this.visitRepo.query(
      `SELECT
         COALESCE(SUM(\`visit_count\`), 0) AS totalVisits,
         COUNT(*)                          AS uniqueVisitors
       FROM \`profile_visits\`
       WHERE \`visited_profile_id\` = ? AND \`is_deleted\` = 0`,
      [profileId],
    );

    return {
      profileId,
      totalVisits: Number(row?.totalVisits ?? 0),
      uniqueVisitors: Number(row?.uniqueVisitors ?? 0),
    };
  }

  /** Dashboard summary for the current user. */
  async getStats(visitorUserId: string): Promise<VisitStatsResponseDto> {
    const [row] = await this.visitRepo.query(
      `SELECT
         COUNT(*) AS totalVisitedProfiles,
         SUM(CASE WHEN \`last_visited_at\` >= CURDATE()                    THEN 1 ELSE 0 END) AS visitedToday,
         SUM(CASE WHEN \`last_visited_at\` >= (NOW() - INTERVAL 7 DAY)     THEN 1 ELSE 0 END) AS visitedThisWeek
       FROM \`profile_visits\`
       WHERE \`visitor_user_id\` = ? AND \`is_deleted\` = 0`,
      [visitorUserId],
    );

    return {
      totalVisitedProfiles: Number(row?.totalVisitedProfiles ?? 0),
      visitedToday: Number(row?.visitedToday ?? 0),
      visitedThisWeek: Number(row?.visitedThisWeek ?? 0),
    };
  }

  // ─── Deletes (soft) ────────────────────────────────────────────────────────

  /** Remove a single profile from the current user's history. */
  async deleteOne(visitorUserId: string, profileId: string): Promise<ProfileVisitMutationResponseDto> {
    const result = await this.visitRepo.update(
      { visitorUserId, visitedProfileId: profileId, isDeleted: false },
      { isDeleted: true, deletedAt: new Date() },
    );

    if (!result.affected) {
      throw new NotFoundException('That profile is not in your recently visited list');
    }

    return { success: true, message: 'Removed from recently visited', affected: result.affected };
  }

  /** Clear the current user's entire history. */
  async clearAll(visitorUserId: string): Promise<ProfileVisitMutationResponseDto> {
    const result = await this.visitRepo.update(
      { visitorUserId, isDeleted: false },
      { isDeleted: true, deletedAt: new Date() },
    );

    return {
      success: true,
      message: 'Recently visited history cleared',
      affected: result.affected ?? 0,
    };
  }

  // ─── Mapping ───────────────────────────────────────────────────────────────

  private toRecentVisitDto(visit: ProfileVisit, matchStatus: string | null): RecentVisitResponseDto {
    const p = visit.visitedProfile;
    const activePhotos = (p?.photos ?? []).filter((ph) => Number(ph.isActive) === 1);
    const primaryPhoto = activePhotos.find((ph) => ph.isPrimary) ?? activePhotos[0];
    const fullName = [p?.firstName, p?.lastName].filter(Boolean).join(' ') || 'Member';

    return {
      profileId: visit.visitedProfileId,
      profileCode: p?.profileCode || null,
      firstName: p?.firstName ?? 'Member',
      lastName: p?.lastName ?? null,
      name: fullName,
      age: p?.age ?? null,
      city: p?.city ?? null,
      state: p?.state ?? null,
      gender: p?.gender ?? null,
      photoUrl: primaryPhoto?.variants?.displayUrl ?? primaryPhoto?.url ?? null,
      visitCount: visit.visitCount,
      lastVisitedAt: visit.lastVisitedAt,
      firstVisitedAt: visit.firstVisitedAt,
      matchStatus,
    };
  }
}
