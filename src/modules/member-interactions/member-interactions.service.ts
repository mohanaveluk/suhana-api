import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, In, Repository } from 'typeorm';
import { Interest } from '../interests/entity/interest.entity';
import { ProfileVisit } from '../profile-visits/entities/profile-visit.entity';
import { Match, Message, Profile, User, UserBlock } from '../user/entity';
import { MatchesService } from '../matches/matches.service';
import { PersonalityService } from '../personality/personality.service';
import {
  HoroscopeBucket, InteractionAction, InteractionCompatibility, InteractionDashboardResponse, InteractionDirection,
  InteractionItem, InteractionListResponse, InteractionPartner, InteractionStatus, InteractionStatusFilter,
  InteractionType, ListInteractionsQueryDto,
} from './dto/member-interactions.dto';

/** Per-source cap when building one member's dashboard (newest first). */
const SOURCE_LIMIT = 500;

/** Excellent/Good/… from the horoscope report's own recommendation text — no new scoring. */
export function horoscopeBucket(category?: string): HoroscopeBucket | undefined {
  const c = (category ?? '').toLowerCase();
  if (!c) return undefined;
  if (c.includes('excellent') || c.includes('highly')) return 'excellent';
  if (c.includes('strong') || c.includes('good')) return 'good';
  if (c.includes('moderate')) return 'moderate';
  return 'low'; // "Requires Further Consideration", "Low …"
}

/** Status shown for an interest. A pending received interest is "new" until opened, then "viewed". */
export function interestStatus(i: Pick<Interest, 'status' | 'isRead'>, direction: InteractionDirection): InteractionStatus {
  if (i.status === 'pending') return direction === 'received' ? (i.isRead ? 'viewed' : 'new') : 'pending';
  return i.status as InteractionStatus;
}

export function matchesStatusFilter(status: InteractionStatus, filter: InteractionStatusFilter = 'all'): boolean {
  if (filter === 'all') return true;
  if (filter === 'pending') return status === 'new' || status === 'viewed' || status === 'pending';
  return status === filter;
}

/** Actions valid for one item. Compatibility never gates sending interest or messaging. */
export function allowedActions(ctx: {
  type: InteractionType;
  direction: InteractionDirection;
  status: InteractionStatus;
  connected: boolean;
  interestExists: boolean;
}): InteractionAction[] {
  const a: InteractionAction[] = ['view_profile'];
  if (ctx.type === 'INTEREST' && ctx.direction === 'received' && (ctx.status === 'new' || ctx.status === 'viewed')) {
    a.push('accept', 'decline');
  }
  if (ctx.type === 'INTEREST' && ctx.direction === 'sent' && ctx.status === 'pending') a.push('withdraw');
  if (ctx.connected) a.push('message');
  if (!ctx.interestExists && !ctx.connected && ctx.type !== 'INTEREST') a.push('send_interest');
  a.push('horoscope', 'personality', 'ai_insights', 'block', 'report');
  return a;
}

/** Best available compatibility score (0–100) for sorting: AI, then personality, then horoscope. */
export function bestScore(c: InteractionCompatibility): number {
  if (c.ai.score != null) return c.ai.score;
  if (c.personality.available && c.personality.score != null) return c.personality.score;
  if (c.horoscope.status === 'analyzed' && c.horoscope.totalScore != null) {
    return Math.round((c.horoscope.totalScore / (c.horoscope.maxScore || 36)) * 100);
  }
  return -1;
}

interface RawItem {
  type: InteractionType;
  partnerUserId: string;
  interest?: Interest;
  visit?: ProfileVisit;
  messages?: { unread: number; lastAt: Date };
  occurredAt: Date;
  updatedAt: Date;
}

/**
 * "My Interests" — one member's received interests, profile views and message threads (or the
 * interests they sent), with partner card data and compatibility from Aurora's existing engines.
 *
 * Read-only: reuses `interests`, `profile_visits`, `messages`, `matches`, the horoscope report cache
 * and personality results. Every query is scoped to the authenticated member; members either side
 * has blocked, and inactive accounts, never appear.
 */
@Injectable()
export class MemberInteractionsService {
  constructor(
    @InjectRepository(Interest) private readonly interestRepo: Repository<Interest>,
    @InjectRepository(ProfileVisit) private readonly visitRepo: Repository<ProfileVisit>,
    @InjectRepository(Message) private readonly messageRepo: Repository<Message>,
    @InjectRepository(Match) private readonly matchRepo: Repository<Match>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(UserBlock) private readonly blockRepo: Repository<UserBlock>,
    private readonly matchesService: MatchesService,
    private readonly personalityService: PersonalityService,
  ) {}

  // ── Dashboard counts ─────────────────────────────────────────────────────
  async dashboard(userId: string): Promise<InteractionDashboardResponse> {
    const blocked = await this.blockedPartnerIds(userId);
    const notBlocked = (col: string) => (blocked.length ? `${col} NOT IN (:...blocked)` : '1=1');

    const received = () => this.interestRepo.createQueryBuilder('i')
      .where('i.toUserId = :userId', { userId })
      .andWhere(notBlocked('i.fromUserId'), { blocked });

    const [totalInterestsReceived, newInterests, pendingRequests, sentPending, acceptedConnections, profileViews, newMessages] =
      await Promise.all([
        received().andWhere("i.status <> 'withdrawn'").getCount(),
        received().andWhere("i.status = 'pending'").andWhere('i.isRead = :r', { r: false }).getCount(),
        received().andWhere("i.status = 'pending'").getCount(),
        this.interestRepo.createQueryBuilder('i')
          .where('i.fromUserId = :userId', { userId }).andWhere("i.status = 'pending'")
          .andWhere(notBlocked('i.toUserId'), { blocked }).getCount(),
        this.interestRepo.createQueryBuilder('i')
          .where("i.status = 'accepted'")
          .andWhere(new Brackets(b => b
            .where(`i.fromUserId = :userId AND ${notBlocked('i.toUserId')}`, { userId, blocked })
            .orWhere(`i.toUserId = :userId AND ${notBlocked('i.fromUserId')}`, { userId, blocked })))
          .getCount(),
        this.visitRepo.createQueryBuilder('v')
          .where('v.visitedUserId = :userId', { userId }).andWhere('v.visitorUserId <> :userId', { userId })
          .andWhere(notBlocked('v.visitorUserId'), { blocked }).getCount(),
        this.messageRepo.createQueryBuilder('m')
          .where('m.receiverId = :userId', { userId }).andWhere('m.isRead = :r', { r: false })
          .andWhere(notBlocked('m.senderId'), { blocked }).getCount(),
      ]);

    return { totalInterestsReceived, newInterests, pendingRequests, acceptedConnections, profileViews, newMessages, sentPending };
  }

  // ── List ─────────────────────────────────────────────────────────────────
  async list(userId: string, q: ListInteractionsQueryDto): Promise<InteractionListResponse> {
    const direction = q.direction ?? 'received';
    const page = q.page ?? 1;
    const limit = q.limit ?? 12;
    const empty: InteractionListResponse = { data: [], total: 0, page, limit, totalPages: 0 };

    const me = await this.userRepo.findOne({ where: { id: userId } });
    if (!me?.profile) return empty;

    const blocked = new Set(await this.blockedPartnerIds(userId));
    const raw = (await this.collect(userId, direction, q.type ?? 'all')).filter(r => !blocked.has(r.partnerUserId));
    if (!raw.length) return empty;

    // Partners (active accounts only) with profile + photos in one query.
    const partnerIds = [...new Set(raw.map(r => r.partnerUserId))];
    const users = await this.userRepo.find({
      where: { id: In(partnerIds), is_active: 1 },
      relations: ['profile', 'profile.photos'],
    });
    const byUser = new Map(users.filter(u => u.profile).map(u => [u.id, u]));
    const items = raw.filter(r => byUser.has(r.partnerUserId));
    if (!items.length) return empty;
    const ids = [...new Set(items.map(r => r.partnerUserId))];

    const [relations, compat] = await Promise.all([
      this.relationsWith(userId, ids),
      this.compatibilityFor(me, ids.map(id => byUser.get(id)!)),
    ]);

    let built: InteractionItem[] = items.map(r => {
      const partnerUser = byUser.get(r.partnerUserId)!;
      const status: InteractionStatus = r.interest
        ? interestStatus(r.interest, direction)
        : r.type === 'MESSAGE' && (r.messages?.unread ?? 0) > 0 ? 'new' : null;
      const connected = relations.connected.has(r.partnerUserId);
      return {
        key: `${r.type}:${r.interest?.id ?? r.visit?.id ?? r.partnerUserId}`,
        type: r.type,
        direction,
        status,
        interestId: r.interest?.id ?? null,
        message: r.interest?.message ?? null,
        source: r.interest?.source ?? null,
        visitCount: r.visit?.visitCount ?? null,
        unreadCount: r.messages?.unread ?? null,
        occurredAt: r.occurredAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
        partner: this.toPartner(partnerUser, connected),
        compatibility: compat.get(r.partnerUserId)!,
        actions: allowedActions({
          type: r.type, direction, status, connected,
          interestExists: relations.withInterest.has(r.partnerUserId),
        }),
      };
    });

    // Filters
    built = built.filter(i => matchesStatusFilter(i.status, q.status));
    const term = q.search?.trim().toLowerCase();
    if (term) {
      built = built.filter(i =>
        i.partner.name.toLowerCase().includes(term) || (i.partner.profileCode ?? '').toLowerCase().includes(term));
    }
    switch (q.compatibility) {
      case 'horoscope_excellent': built = built.filter(i => i.compatibility.horoscope.bucket === 'excellent'); break;
      case 'horoscope_good': built = built.filter(i => i.compatibility.horoscope.bucket === 'good'); break;
      case 'personality_match':
        built = built.filter(i => i.compatibility.personality.available
          && ['Excellent', 'Good'].includes(i.compatibility.personality.level ?? ''));
        break;
      case 'ai_recommended': built = built.filter(i => i.compatibility.ai.recommended); break;
      case 'not_available':
        built = built.filter(i => i.compatibility.ai.score == null && !i.compatibility.personality.available
          && i.compatibility.horoscope.status !== 'analyzed');
        break;
    }

    // Sort
    const t = (s: string) => new Date(s).getTime();
    switch (q.sort) {
      case 'oldest': built.sort((a, b) => t(a.occurredAt) - t(b.occurredAt)); break;
      case 'updated': built.sort((a, b) => t(b.updatedAt) - t(a.updatedAt)); break;
      case 'compatibility':
        built.sort((a, b) => bestScore(b.compatibility) - bestScore(a.compatibility) || t(b.occurredAt) - t(a.occurredAt));
        break;
      default: built.sort((a, b) => t(b.occurredAt) - t(a.occurredAt));
    }

    const total = built.length;
    return {
      data: built.slice((page - 1) * limit, page * limit),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // ── internals ────────────────────────────────────────────────────────────

  /** Members this member blocked, or who blocked this member (active blocks). */
  private async blockedPartnerIds(userId: string): Promise<string[]> {
    const rows = await this.blockRepo.createQueryBuilder('b')
      .where('b.isActive = 1')
      .andWhere('(b.blockedByUserId = :userId OR b.blockedUserId = :userId)', { userId })
      .getMany();
    return [...new Set(rows.map(b => (b.blockedByUserId === userId ? b.blockedUserId : b.blockedByUserId)))];
  }

  private async collect(userId: string, direction: InteractionDirection, type: string): Promise<RawItem[]> {
    const out: RawItem[] = [];
    const want = (t: string) => type === 'all' || type === t;

    if (direction === 'sent') {
      if (!want('interests')) return out;
      const sent = await this.interestRepo.find({ where: { fromUserId: userId }, order: { createdAt: 'DESC' }, take: SOURCE_LIMIT });
      return sent.map(i => ({
        type: 'INTEREST' as const, partnerUserId: i.toUserId, interest: i,
        occurredAt: i.createdAt, updatedAt: i.updatedAt ?? i.createdAt,
      }));
    }

    if (want('interests')) {
      const received = await this.interestRepo.find({ where: { toUserId: userId }, order: { createdAt: 'DESC' }, take: SOURCE_LIMIT });
      for (const i of received) {
        out.push({ type: 'INTEREST', partnerUserId: i.fromUserId, interest: i, occurredAt: i.createdAt, updatedAt: i.updatedAt ?? i.createdAt });
      }
    }
    if (want('profile_views')) {
      const visits = await this.visitRepo.createQueryBuilder('v')
        .where('v.visitedUserId = :userId', { userId })
        .andWhere('v.visitorUserId <> :userId', { userId })
        .orderBy('v.lastVisitedAt', 'DESC')
        .take(SOURCE_LIMIT)
        .getMany();
      for (const v of visits) {
        out.push({ type: 'PROFILE_VIEW', partnerUserId: v.visitorUserId, visit: v, occurredAt: v.lastVisitedAt, updatedAt: v.lastVisitedAt });
      }
    }
    if (want('messages')) {
      const threads: { senderId: string; unread: string | number; lastAt: Date | string }[] = await this.messageRepo
        .createQueryBuilder('m')
        .select('m.senderId', 'senderId')
        .addSelect('SUM(CASE WHEN m.isRead = 0 THEN 1 ELSE 0 END)', 'unread')
        .addSelect('MAX(m.timestamp)', 'lastAt')
        .where('m.receiverId = :userId', { userId })
        .andWhere("m.type <> 'system'")
        .groupBy('m.senderId')
        .orderBy('lastAt', 'DESC')
        .limit(SOURCE_LIMIT)
        .getRawMany();
      for (const t of threads) {
        const lastAt = new Date(t.lastAt);
        out.push({ type: 'MESSAGE', partnerUserId: t.senderId, messages: { unread: Number(t.unread) || 0, lastAt }, occurredAt: lastAt, updatedAt: lastAt });
      }
    }
    return out;
  }

  /** Which partners are connected (accepted interest either way) or already have an open/answered interest. */
  private async relationsWith(userId: string, partnerIds: string[]) {
    const rows = await this.interestRepo.createQueryBuilder('i')
      .select(['i.fromUserId', 'i.toUserId', 'i.status'])
      .where("i.status <> 'withdrawn'")
      .andWhere(new Brackets(b => b
        .where('i.fromUserId = :userId AND i.toUserId IN (:...ids)', { userId, ids: partnerIds })
        .orWhere('i.toUserId = :userId AND i.fromUserId IN (:...ids)', { userId, ids: partnerIds })))
      .getMany();
    const connected = new Set<string>();
    const withInterest = new Set<string>();
    for (const r of rows) {
      const partner = r.fromUserId === userId ? r.toUserId : r.fromUserId;
      withInterest.add(partner);
      if (r.status === 'accepted') connected.add(partner);
    }
    return { connected, withInterest };
  }

  /** AI score (matches table), cached horoscope report and personality — existing engines only. */
  private async compatibilityFor(me: User, partners: User[]): Promise<Map<string, InteractionCompatibility>> {
    const ids = partners.map(p => p.id);
    const [aiRows, horoscope, personality] = await Promise.all([
      this.matchRepo.createQueryBuilder('m')
        .select(['m.userId', 'm.matchedUserId', 'm.matchPercentage'])
        .where('(m.userId = :me AND m.matchedUserId IN (:...ids)) OR (m.matchedUserId = :me AND m.userId IN (:...ids))', { me: me.id, ids })
        .getMany(),
      this.matchesService.getCachedHoroscopeSummaries(
        { userId: me.id, profile: me.profile },
        partners.map(p => ({ userId: p.id, profile: p.profile })),
      ),
      this.personalityService.getCompatibilitySummaries(me.profile.id, partners.map(p => p.profile.id)),
    ]);

    // A score of 0 means "no AI scoring happened" (interest rows create placeholder matches with 0).
    const ai = new Map<string, number>();
    for (const r of aiRows) {
      const partner = r.userId === me.id ? r.matchedUserId : r.userId;
      if (r.matchPercentage > 0) ai.set(partner, Math.max(ai.get(partner) ?? 0, Math.round(r.matchPercentage)));
    }

    const out = new Map<string, InteractionCompatibility>();
    for (const p of partners) {
      const h = horoscope.get(p.id) ?? { status: 'not_available' as const };
      const pc = personality.byProfile.get(p.profile.id);
      out.set(p.id, {
        ai: { score: ai.get(p.id) ?? null, recommended: ai.has(p.id) },
        horoscope: { ...h, bucket: h.status === 'analyzed' ? horoscopeBucket(h.category) : undefined },
        personality: {
          available: !!pc?.available,
          myType: personality.myType,
          partnerType: pc?.personalityType ?? null,
          ...(pc?.available ? { score: pc.score, level: pc.level } : {}),
        },
      });
    }
    return out;
  }

  /**
   * Card data. Only list-level fields — never contact details, address, family names or birth data.
   * Photo privacy: shown when the member allows everyone, otherwise only once you are connected.
   */
  private toPartner(u: User, connected: boolean): InteractionPartner {
    const p: Profile = u.profile;
    const photos = (p.photos ?? []).filter(ph => Number(ph.isActive ?? 1) === 1);
    const photo = photos.find(ph => ph.isPrimary) ?? photos[0];
    const privacy = p.photoPrivacy ?? 'everyone';
    const visible = privacy === 'everyone' || connected;
    return {
      userId: u.id,
      profileId: p.id,
      profileCode: p.profileCode ?? null,
      name: [p.firstName, p.lastName].filter(Boolean).join(' ').trim() || 'Aurora member',
      age: p.age ?? null,
      city: p.city ?? null,
      state: p.state ?? null,
      country: p.country ?? null,
      occupation: p.occupationTitle ?? null,
      education: p.educationLevel ?? null,
      photoUrl: visible && photo ? (photo.variants?.thumbnailUrl ?? photo.variants?.displayUrl ?? photo.url) : null,
      photoHidden: !!photo && !visible,
      mobileVerified: Number(u.isMobileVerified) === 1,
      photoVerified: !!photo?.isVerified,
    };
  }
}
