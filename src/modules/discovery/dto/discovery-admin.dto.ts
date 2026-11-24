import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsEmail, IsIn, IsInt, IsLatitude, IsLongitude, IsNotEmpty,
  IsNumber, IsObject, IsOptional, IsString, IsUrl, Matches, Max, MaxLength, Min, ValidateNested,
} from 'class-validator';
import {
  ASTROLOGER_SPECIALIZATIONS, DISCOVERY_LANGUAGES, SUPPORTED_COUNTRY_CODES, WEEK_DAYS,
} from '../constants/discovery.constants';
import { ConsultationMode, DiscoveryReviewStatus, ProviderVerificationStatus } from '../constants/discovery.enums';
import { toStringArray } from './discovery-search.dto';

const upper = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toUpperCase() : value);
const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const emptyToNull = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? (value.trim() === '' ? null : value.trim()) : value;

export class LocationInputDto {
  @ApiPropertyOptional({ example: 'Main office' })
  @IsOptional() @Transform(emptyToNull) @IsString() @MaxLength(100)
  label?: string | null;

  @ApiPropertyOptional() @IsOptional() @Transform(emptyToNull) @IsString() @MaxLength(255)
  addressLine1?: string | null;

  @ApiPropertyOptional() @IsOptional() @Transform(emptyToNull) @IsString() @MaxLength(255)
  addressLine2?: string | null;

  @ApiProperty({ example: 'Chennai' })
  @Transform(trim) @IsString() @IsNotEmpty() @MaxLength(100)
  city: string;

  @ApiPropertyOptional({ example: 'Tamil Nadu' })
  @IsOptional() @Transform(emptyToNull) @IsString() @MaxLength(100)
  state?: string | null;

  @ApiPropertyOptional({ example: '600001', description: 'Used to geocode when lat/lng are omitted.' })
  @IsOptional() @Transform(emptyToNull) @IsString() @MaxLength(12)
  postalCode?: string | null;

  @ApiProperty({ enum: SUPPORTED_COUNTRY_CODES })
  @Transform(upper) @IsIn(SUPPORTED_COUNTRY_CODES)
  country: string;

  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsLatitude()
  latitude?: number | null;

  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsLongitude()
  longitude?: number | null;

  @ApiPropertyOptional({ default: true, description: 'False hides street address + directions (home-based providers).' })
  @IsOptional() @IsBoolean()
  showStreetAddress?: boolean;

  @ApiPropertyOptional({ default: false }) @IsOptional() @IsBoolean()
  isPrimary?: boolean;

  @ApiPropertyOptional({ default: true }) @IsOptional() @IsBoolean()
  isActive?: boolean;
}

export class ServiceInputDto {
  @ApiProperty({ example: 'Horoscope matching' })
  @Transform(trim) @IsString() @IsNotEmpty() @MaxLength(150)
  name: string;

  @ApiPropertyOptional({ example: 'horoscope-matching' })
  @IsOptional() @Transform(emptyToNull) @IsString() @MaxLength(64)
  specialization?: string | null;

  @ApiProperty({ enum: ConsultationMode })
  @IsIn(Object.values(ConsultationMode))
  consultationMode: ConsultationMode;

  @ApiPropertyOptional({ nullable: true, description: 'Omit for "price on request".' })
  @IsOptional() @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(99999999)
  price?: number | null;

  @ApiPropertyOptional({ example: 'INR', description: 'Defaults to the country currency of the primary location.' })
  @IsOptional() @Transform(upper) @IsIn(['USD', 'INR'])
  currency?: string | null;

  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(5) @Max(1440)
  durationMinutes?: number | null;

  @ApiPropertyOptional() @IsOptional() @Transform(emptyToNull) @IsString() @MaxLength(500)
  description?: string | null;

  @ApiPropertyOptional({ default: true }) @IsOptional() @IsBoolean()
  isActive?: boolean;
}

export class BusinessHoursInputDto {
  @ApiProperty({ enum: WEEK_DAYS }) @IsIn([...WEEK_DAYS])
  day: string;

  @ApiProperty({ example: '09:00' }) @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  open: string;

  @ApiProperty({ example: '18:00' }) @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  close: string;
}

export class CertificationInputDto {
  @ApiProperty() @Transform(trim) @IsString() @IsNotEmpty() @MaxLength(150)
  name: string;

  @ApiPropertyOptional() @IsOptional() @Transform(emptyToNull) @IsString() @MaxLength(150)
  issuer?: string | null;

  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(1900) @Max(2100)
  year?: number | null;

  @ApiPropertyOptional({ default: false, description: 'Set true only after checking the credential itself.' })
  @IsOptional() @IsBoolean()
  verified?: boolean;
}

export class AstrologerDetailInputDto {
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(80)
  experienceYears?: number | null;

  @ApiPropertyOptional({ enum: ASTROLOGER_SPECIALIZATIONS, isArray: true })
  @IsOptional() @IsArray() @IsIn([...ASTROLOGER_SPECIALIZATIONS], { each: true })
  specializations?: string[];

  @ApiPropertyOptional({ type: [BusinessHoursInputDto] })
  @IsOptional() @IsArray() @ArrayMaxSize(21) @ValidateNested({ each: true }) @Type(() => BusinessHoursInputDto)
  businessHours?: BusinessHoursInputDto[];

  @ApiPropertyOptional({ type: [CertificationInputDto] })
  @IsOptional() @IsArray() @ArrayMaxSize(20) @ValidateNested({ each: true }) @Type(() => CertificationInputDto)
  certifications?: CertificationInputDto[];

  @ApiPropertyOptional() @IsOptional() @Transform(emptyToNull) @IsString() @MaxLength(255)
  availabilityNote?: string | null;
}

/** Details for one non-astrologer category (typed attributes are validated against CATEGORY_DEFINITIONS). */
export class CategoryDetailInputDto {
  @ApiProperty({ example: 'marriage-hall' })
  @IsString() @IsNotEmpty() @MaxLength(64)
  categorySlug: string;

  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(80)
  experienceYears?: number | null;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional() @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) @MaxLength(64, { each: true })
  specialties?: string[];

  @ApiPropertyOptional({ description: 'Typed per category, e.g. { capacityMax: 800, parking: true }. Unknown keys are dropped.' })
  @IsOptional() @IsObject()
  attributes?: Record<string, unknown>;

  @ApiPropertyOptional({ type: [BusinessHoursInputDto] })
  @IsOptional() @IsArray() @ArrayMaxSize(21) @ValidateNested({ each: true }) @Type(() => BusinessHoursInputDto)
  businessHours?: BusinessHoursInputDto[];

  @ApiPropertyOptional({ type: [CertificationInputDto] })
  @IsOptional() @IsArray() @ArrayMaxSize(20) @ValidateNested({ each: true }) @Type(() => CertificationInputDto)
  certifications?: CertificationInputDto[];

  @ApiPropertyOptional() @IsOptional() @Transform(emptyToNull) @IsString() @MaxLength(255)
  availabilityNote?: string | null;
}

/**
 * Fields shared by create/update. On update, any array that is sent REPLACES
 * the stored set (categories, languages, services); omitted arrays are kept.
 * Locations are managed through their own endpoints after creation.
 */
export class ProviderBaseInputDto {
  @ApiPropertyOptional({ nullable: true }) @IsOptional() @Transform(emptyToNull) @IsString() @MaxLength(150)
  businessName?: string | null;

  @ApiPropertyOptional({ nullable: true }) @IsOptional() @Transform(emptyToNull) @IsString() @MaxLength(200)
  headline?: string | null;

  @ApiPropertyOptional({ nullable: true }) @IsOptional() @Transform(emptyToNull) @IsString() @MaxLength(5000)
  about?: string | null;

  @ApiPropertyOptional({ nullable: true }) @IsOptional() @Transform(emptyToNull) @IsUrl({ require_protocol: true }) @MaxLength(500)
  photoUrl?: string | null;

  @ApiPropertyOptional({ nullable: true }) @IsOptional() @Transform(emptyToNull) @IsEmail() @MaxLength(255)
  email?: string | null;

  @ApiPropertyOptional({ nullable: true, example: '+91 98400 12345' })
  @IsOptional() @Transform(emptyToNull) @Matches(/^\+?[0-9 ()-]{7,24}$/, { message: 'phone must be a valid phone number' })
  phone?: string | null;

  @ApiPropertyOptional({ nullable: true }) @IsOptional() @Transform(emptyToNull) @IsUrl({ require_protocol: true }) @MaxLength(500)
  website?: string | null;

  @ApiPropertyOptional({ default: true }) @IsOptional() @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ default: true }) @IsOptional() @IsBoolean()
  acceptingClients?: boolean;

  @ApiPropertyOptional({ enum: DISCOVERY_LANGUAGES, isArray: true })
  @IsOptional() @IsArray() @IsIn([...DISCOVERY_LANGUAGES], { each: true })
  languages?: string[];

  @ApiPropertyOptional({ type: [ServiceInputDto] })
  @IsOptional() @IsArray() @ArrayMaxSize(30) @ValidateNested({ each: true }) @Type(() => ServiceInputDto)
  services?: ServiceInputDto[];

  @ApiPropertyOptional({ type: AstrologerDetailInputDto })
  @IsOptional() @ValidateNested() @Type(() => AstrologerDetailInputDto)
  astrologer?: AstrologerDetailInputDto;

  @ApiPropertyOptional({ type: [CategoryDetailInputDto], description: 'Details for non-astrologer categories, one per category slug.' })
  @IsOptional() @IsArray() @ArrayMaxSize(7) @ValidateNested({ each: true }) @Type(() => CategoryDetailInputDto)
  categoryDetails?: CategoryDetailInputDto[];
}

export class CreateProviderDto extends ProviderBaseInputDto {
  @ApiProperty({ example: 'Pandit R. Sharma' })
  @Transform(trim) @IsString() @IsNotEmpty() @MaxLength(150)
  displayName: string;

  @ApiProperty({ type: [String], example: ['astrologer'] })
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(5) @IsString({ each: true })
  categorySlugs: string[];

  @ApiPropertyOptional({ type: [LocationInputDto] })
  @IsOptional() @IsArray() @ArrayMaxSize(20) @ValidateNested({ each: true }) @Type(() => LocationInputDto)
  locations?: LocationInputDto[];
}

export class UpdateProviderDto extends ProviderBaseInputDto {
  @ApiPropertyOptional() @IsOptional() @Transform(trim) @IsString() @IsNotEmpty() @MaxLength(150)
  displayName?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional() @IsArray() @ArrayMinSize(1) @ArrayMaxSize(5) @IsString({ each: true })
  categorySlugs?: string[];
}

export class UpdateLocationDto extends LocationInputDto {}

export class ProviderVerificationDto {
  @ApiProperty({ enum: ProviderVerificationStatus })
  @IsIn(Object.values(ProviderVerificationStatus))
  status: ProviderVerificationStatus;

  @ApiPropertyOptional({ description: 'Internal note (required for REJECTED / SUSPENDED).' })
  @IsOptional() @Transform(emptyToNull) @IsString() @MaxLength(500)
  notes?: string | null;
}

export class AdminProviderQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(80)
  q?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(64)
  category?: string;

  @ApiPropertyOptional({ enum: ProviderVerificationStatus })
  @IsOptional() @IsIn(Object.values(ProviderVerificationStatus))
  status?: ProviderVerificationStatus;

  @ApiPropertyOptional({ enum: SUPPORTED_COUNTRY_CODES })
  @IsOptional() @Transform(upper) @IsIn(SUPPORTED_COUNTRY_CODES)
  country?: string;

  @ApiPropertyOptional({ description: 'Include soft-deleted listings.' })
  @IsOptional() @Transform(({ value }) => value === true || value === 'true') @IsBoolean()
  includeDeleted?: boolean;

  @ApiPropertyOptional({ default: 1 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 20, maximum: 100 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)
  limit?: number;
}

export class AdminReviewQueryDto {
  @ApiPropertyOptional({ enum: DiscoveryReviewStatus })
  @IsOptional() @IsIn(Object.values(DiscoveryReviewStatus))
  status?: DiscoveryReviewStatus;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(36)
  providerId?: string;

  @ApiPropertyOptional({ default: 1 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 20, maximum: 100 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)
  limit?: number;
}

export class ModerateReviewDto {
  @ApiProperty({ enum: DiscoveryReviewStatus })
  @IsIn(Object.values(DiscoveryReviewStatus))
  status: DiscoveryReviewStatus;

  @ApiPropertyOptional() @IsOptional() @Transform(emptyToNull) @IsString() @MaxLength(500)
  note?: string | null;
}

export class UpdateCategoryDto {
  @ApiPropertyOptional() @IsOptional() @Transform(trim) @IsString() @IsNotEmpty() @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ nullable: true }) @IsOptional() @Transform(emptyToNull) @IsString() @MaxLength(500)
  description?: string | null;

  @ApiPropertyOptional() @IsOptional() @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(1000)
  displayOrder?: number;

  @ApiPropertyOptional({ nullable: true }) @IsOptional() @Transform(emptyToNull) @IsString() @MaxLength(64)
  icon?: string | null;

  @ApiPropertyOptional({ nullable: true }) @IsOptional() @Transform(emptyToNull) @IsString() @MaxLength(255)
  imageUrl?: string | null;
}

export class GeocodeQueryDto {
  @ApiProperty({ enum: SUPPORTED_COUNTRY_CODES }) @Transform(upper) @IsIn(SUPPORTED_COUNTRY_CODES)
  country: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(12)
  postalCode?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100)
  city?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100)
  state?: string;
}

export class MediaCaptionDto {
  @ApiPropertyOptional() @IsOptional() @Transform(emptyToNull) @IsString() @MaxLength(200)
  caption?: string | null;

  @ApiPropertyOptional({ description: 'Also use this image as the listing photo.' })
  @IsOptional() @Transform(({ value }) => value === true || value === 'true') @IsBoolean()
  setAsPhoto?: boolean;
}

export { toStringArray };
