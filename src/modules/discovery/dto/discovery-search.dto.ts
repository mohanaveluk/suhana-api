import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsArray, IsBoolean, IsIn, IsInt, IsLatitude, IsLongitude, IsNotEmpty, IsNumber, IsOptional, IsString, Max,
  MaxLength, Min,
} from 'class-validator';
import {
  ASTROLOGER_SPECIALIZATIONS, DISCOVERY_PAGE_SIZE_DEFAULT, DISCOVERY_PAGE_SIZE_MAX, RADIUS_OPTIONS,
} from '../constants/discovery.constants';
import { ConsultationMode, DiscoverySort } from '../constants/discovery.enums';

/** Accepts `?x=a,b` or `?x=a&x=b`; trims, drops empties, de-duplicates. */
export const toStringArray = ({ value }: { value: unknown }): string[] | undefined => {
  if (value === undefined || value === null || value === '') return undefined;
  const raw = Array.isArray(value) ? value : String(value).split(',');
  const out = raw.map((v) => String(v).trim()).filter(Boolean);
  return out.length ? Array.from(new Set(out)) : undefined;
};

const toNumber = ({ value }: { value: unknown }) =>
  value === undefined || value === null || value === '' ? undefined : Number(value);

const toBool = ({ value }: { value: unknown }) => {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'boolean') return value;
  return ['true', '1', 'yes'].includes(String(value).toLowerCase());
};

export const RADIUS_VALUES = [...RADIUS_OPTIONS.map(String), 'all'];

/** Location + generic facets shared by every category search. */
export class DiscoverySearchQueryDto {
  @ApiPropertyOptional({ description: 'ISO country code. Supported: US, IN.', example: 'IN' })
  @IsOptional() @IsString() @MaxLength(2)
  country?: string;

  @ApiPropertyOptional({ description: 'US ZIP (5 digits) or India PIN (6 digits).', example: '600001' })
  @IsOptional() @IsString() @MaxLength(12)
  postalCode?: string;

  @ApiPropertyOptional({ example: 'Chennai' })
  @IsOptional() @IsString() @MaxLength(100)
  city?: string;

  @ApiPropertyOptional({ example: 'Tamil Nadu' })
  @IsOptional() @IsString() @MaxLength(100)
  state?: string;

  @ApiPropertyOptional({
    description: 'Device latitude — only after the member clicks "Use my location". Coarsened to ~1 km server-side; never stored.',
  })
  @IsOptional() @Transform(toNumber) @IsLatitude()
  lat?: number;

  @ApiPropertyOptional({ description: 'Device longitude (see lat).' })
  @IsOptional() @Transform(toNumber) @IsLongitude()
  lng?: number;

  @ApiPropertyOptional({ enum: RADIUS_VALUES, default: '25' })
  @IsOptional() @IsString() @IsIn(RADIUS_VALUES)
  radius?: string;

  @ApiPropertyOptional({ enum: ['mi', 'km'], description: 'Defaults to mi for US, km for India.' })
  @IsOptional() @IsIn(['mi', 'km'])
  unit?: 'mi' | 'km';

  @ApiPropertyOptional({ type: [String], description: 'Language codes (comma-separated or repeated), e.g. ta,en' })
  @IsOptional() @Transform(toStringArray) @IsArray() @IsString({ each: true }) @MaxLength(8, { each: true })
  language?: string[];

  @ApiPropertyOptional({ enum: ConsultationMode, isArray: true })
  @IsOptional() @Transform(toStringArray) @IsArray() @IsIn(Object.values(ConsultationMode), { each: true })
  consultationMode?: ConsultationMode[];

  @ApiPropertyOptional({ minimum: 1, maximum: 5 })
  @IsOptional() @Transform(toNumber) @IsNumber() @Min(1) @Max(5)
  minRating?: number;

  @ApiPropertyOptional({ description: 'Minimum fee, in the listing currency.' })
  @IsOptional() @Transform(toNumber) @IsNumber() @Min(0)
  minPrice?: number;

  @ApiPropertyOptional({ description: 'Maximum fee, in the listing currency.' })
  @IsOptional() @Transform(toNumber) @IsNumber() @Min(0)
  maxPrice?: number;

  @ApiPropertyOptional({ description: 'Only listings whose business details Aurora has verified.' })
  @IsOptional() @Transform(toBool) @IsBoolean()
  verifiedOnly?: boolean;

  @ApiPropertyOptional({ description: 'Name contains (display or business name).' })
  @IsOptional() @IsString() @MaxLength(80)
  q?: string;

  @ApiPropertyOptional({
    type: [String],
    description: `Category specialty codes (any of). Astrologer: ${ASTROLOGER_SPECIALIZATIONS.join(', ')}. Other categories: see GET discovery/categories/:slug docs.`,
  })
  @IsOptional() @Transform(toStringArray) @IsArray() @IsString({ each: true }) @MaxLength(64, { each: true })
  specialization?: string[];

  @ApiPropertyOptional({ minimum: 0, maximum: 60 })
  @IsOptional() @Transform(toNumber) @IsInt() @Min(0) @Max(60)
  minExperience?: number;

  @ApiPropertyOptional({ description: 'Minimum guest capacity (marriage halls, catering).', minimum: 1 })
  @IsOptional() @Transform(toNumber) @IsInt() @Min(1) @Max(100000)
  minCapacity?: number;

  @ApiPropertyOptional({ enum: DiscoverySort, default: DiscoverySort.RECOMMENDED })
  @IsOptional() @IsIn(Object.values(DiscoverySort))
  sortBy?: DiscoverySort;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: DISCOVERY_PAGE_SIZE_DEFAULT, maximum: DISCOVERY_PAGE_SIZE_MAX })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(DISCOVERY_PAGE_SIZE_MAX)
  limit?: number;
}

/** Kept as a named type for the astrologer endpoints; specialty codes are validated by the category handler. */
export class AstrologerSearchQueryDto extends DiscoverySearchQueryDto {}

export class ProviderSearchQueryDto extends AstrologerSearchQueryDto {
  @ApiProperty({ description: 'Category slug', example: 'astrologer' })
  @IsString() @IsNotEmpty() @MaxLength(64)
  category: string;
}

// ── Responses ─────────────────────────────────────────────────────────────

export class DistanceDto {
  @ApiProperty() value: number;
  @ApiProperty({ enum: ['mi', 'km'] }) unit: 'mi' | 'km';
}

export class MoneyDto {
  @ApiProperty() amount: number;
  @ApiProperty() currency: string;
}

export class ProviderPlaceDto {
  @ApiProperty() city: string;
  @ApiPropertyOptional({ nullable: true }) state: string | null;
  @ApiProperty() country: string;
  @ApiPropertyOptional({ nullable: true, description: 'Only when the listing shows its street address.' })
  postalCode: string | null;
  @ApiPropertyOptional({ nullable: true, description: 'Full street address, only when shown publicly.' })
  address: string | null;
}

export class RatingSummaryDto {
  @ApiPropertyOptional({ nullable: true, description: 'Average of approved reviews; null when there are none.' })
  average: number | null;
  @ApiProperty() count: number;
}

export class AstrologerSummaryDto {
  @ApiPropertyOptional({ nullable: true }) experienceYears: number | null;
  @ApiProperty({ type: [String] }) specializations: string[];
}

/** Uniform category details shown on cards, for every category. */
export class CategoryDetailsSummaryDto {
  @ApiPropertyOptional({ nullable: true }) experienceYears: number | null;
  @ApiProperty({ type: [String], description: 'Category specialty codes.' }) specialties: string[];
  @ApiProperty({ description: 'Typed per category (e.g. capacityMax for marriage halls). Values are as stated by the provider.' })
  attributes: Record<string, number | boolean | string>;
}

export class ProviderCardDto {
  @ApiProperty() id: string;
  @ApiProperty() categorySlug: string;
  @ApiProperty() displayName: string;
  @ApiPropertyOptional({ nullable: true }) businessName: string | null;
  @ApiPropertyOptional({ nullable: true }) headline: string | null;
  @ApiPropertyOptional({ nullable: true }) photoUrl: string | null;
  @ApiProperty({ description: 'True only when verificationStatus = VERIFIED (business listing verified).' })
  isVerified: boolean;
  @ApiProperty() acceptingClients: boolean;
  @ApiProperty({ type: RatingSummaryDto }) rating: RatingSummaryDto;
  @ApiPropertyOptional({ type: DistanceDto, nullable: true }) distance: DistanceDto | null;
  @ApiPropertyOptional({ type: ProviderPlaceDto, nullable: true }) place: ProviderPlaceDto | null;
  @ApiProperty() locationCount: number;
  @ApiProperty({ type: [String] }) languages: string[];
  @ApiProperty({ enum: ConsultationMode, isArray: true }) consultationModes: ConsultationMode[];
  @ApiPropertyOptional({ type: MoneyDto, nullable: true }) startingPrice: MoneyDto | null;
  @ApiPropertyOptional({ type: AstrologerSummaryDto, nullable: true }) astrologer: AstrologerSummaryDto | null;
  @ApiPropertyOptional({ type: CategoryDetailsSummaryDto, nullable: true }) details: CategoryDetailsSummaryDto | null;
  @ApiProperty() isFavorite: boolean;
}

export class SearchOriginDto {
  @ApiProperty({ enum: ['point', 'area', 'none'] }) type: 'point' | 'area' | 'none';
  @ApiProperty() label: string;
  @ApiPropertyOptional({ nullable: true }) country: string | null;
  @ApiProperty({ enum: ['mi', 'km'] }) unit: 'mi' | 'km';
  @ApiPropertyOptional({ nullable: true, description: 'Radius applied, in `unit`; null = no limit.' })
  radius: number | null;
}

export class RankingInfoDto {
  @ApiProperty({ enum: DiscoverySort }) requested: DiscoverySort;
  @ApiProperty({ enum: DiscoverySort }) applied: DiscoverySort;
  @ApiProperty() description: string;
  @ApiPropertyOptional({ description: 'Factor weights when applied = recommended.' })
  factors?: Record<string, number>;
  @ApiPropertyOptional({ nullable: true }) notice: string | null;
}

export class ProviderSearchResponseDto {
  @ApiProperty({ type: [ProviderCardDto] }) items: ProviderCardDto[];
  @ApiProperty() total: number;
  @ApiProperty() page: number;
  @ApiProperty() limit: number;
  @ApiProperty() totalPages: number;
  @ApiProperty({ type: SearchOriginDto }) origin: SearchOriginDto;
  @ApiProperty({ type: RankingInfoDto }) ranking: RankingInfoDto;
}
