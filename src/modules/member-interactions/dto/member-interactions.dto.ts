import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export const INTERACTION_DIRECTIONS = ['received', 'sent'] as const;
export const INTERACTION_TYPE_FILTERS = ['all', 'interests', 'profile_views', 'messages'] as const;
export const INTERACTION_STATUS_FILTERS = ['all', 'new', 'viewed', 'pending', 'accepted', 'declined', 'withdrawn'] as const;
export const COMPATIBILITY_FILTERS = ['all', 'horoscope_excellent', 'horoscope_good', 'personality_match', 'ai_recommended', 'not_available'] as const;
export const INTERACTION_SORTS = ['newest', 'oldest', 'compatibility', 'updated'] as const;

export type InteractionDirection = (typeof INTERACTION_DIRECTIONS)[number];
export type InteractionTypeFilter = (typeof INTERACTION_TYPE_FILTERS)[number];
export type InteractionStatusFilter = (typeof INTERACTION_STATUS_FILTERS)[number];
export type CompatibilityFilter = (typeof COMPATIBILITY_FILTERS)[number];
export type InteractionSort = (typeof INTERACTION_SORTS)[number];

export class ListInteractionsQueryDto {
  @ApiPropertyOptional({ enum: INTERACTION_DIRECTIONS, default: 'received' })
  @IsOptional() @IsIn([...INTERACTION_DIRECTIONS])
  direction?: InteractionDirection = 'received';

  @ApiPropertyOptional({ enum: INTERACTION_TYPE_FILTERS, default: 'all' })
  @IsOptional() @IsIn([...INTERACTION_TYPE_FILTERS])
  type?: InteractionTypeFilter = 'all';

  @ApiPropertyOptional({ enum: INTERACTION_STATUS_FILTERS, default: 'all' })
  @IsOptional() @IsIn([...INTERACTION_STATUS_FILTERS])
  status?: InteractionStatusFilter = 'all';

  @ApiPropertyOptional({ enum: COMPATIBILITY_FILTERS, default: 'all' })
  @IsOptional() @IsIn([...COMPATIBILITY_FILTERS])
  compatibility?: CompatibilityFilter = 'all';

  @ApiPropertyOptional({ enum: INTERACTION_SORTS, default: 'newest' })
  @IsOptional() @IsIn([...INTERACTION_SORTS])
  sort?: InteractionSort = 'newest';

  @ApiPropertyOptional({ description: 'Partner name or profile ID (case-insensitive, partial)' })
  @IsOptional() @IsString() @MaxLength(80)
  search?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 12, maximum: 50 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50)
  limit?: number = 12;
}

// ── Response shapes (documented for Swagger consumers; mirrored by the web app's model) ──

export type InteractionType = 'INTEREST' | 'PROFILE_VIEW' | 'MESSAGE';
export type InteractionStatus = 'new' | 'viewed' | 'pending' | 'accepted' | 'declined' | 'withdrawn' | null;
export type InteractionAction =
  | 'view_profile' | 'accept' | 'decline' | 'withdraw' | 'send_interest' | 'message'
  | 'horoscope' | 'personality' | 'ai_insights' | 'block' | 'report';
export type HoroscopeBucket = 'excellent' | 'good' | 'moderate' | 'low';

export interface InteractionPartner {
  userId: string;          // account id
  profileId: string;       // profile id (what /profile-view/:id, chat ?profileId= and personality use)
  profileCode: string | null;
  name: string;
  age: number | null;
  city: string | null;
  state: string | null;
  country: string | null;
  occupation: string | null;
  education: string | null;
  photoUrl: string | null;
  /** The member's photo privacy setting hides their photo from you. */
  photoHidden: boolean;
  mobileVerified: boolean;
  photoVerified: boolean;
}

export interface InteractionCompatibility {
  ai: { score: number | null; recommended: boolean };
  horoscope: {
    status: 'analyzed' | 'not_analyzed' | 'not_available';
    totalScore?: number;
    maxScore?: number;
    category?: string;
    bucket?: HoroscopeBucket;
  };
  personality: {
    available: boolean;
    myType: string | null;
    partnerType: string | null;
    score?: number;
    level?: string;
  };
}

export interface InteractionItem {
  /** Stable key: `${type}:${id}` */
  key: string;
  type: InteractionType;
  direction: InteractionDirection;
  status: InteractionStatus;
  interestId: string | null;
  message: string | null;
  source: string | null;
  visitCount: number | null;
  unreadCount: number | null;
  /** Latest activity of this interaction (ISO). */
  occurredAt: string;
  updatedAt: string;
  partner: InteractionPartner;
  compatibility: InteractionCompatibility;
  /** Actions valid for this item right now (computed server-side). */
  actions: InteractionAction[];
}

export interface InteractionListResponse {
  data: InteractionItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface InteractionDashboardResponse {
  totalInterestsReceived: number;
  newInterests: number;
  pendingRequests: number;
  acceptedConnections: number;
  profileViews: number;
  newMessages: number;
  sentPending: number;
}
