import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from 'class-validator';
import { PaginationQueryDto } from 'src/common/dto/pagination.dto';
import { ReportReason, ReportStatus, ReviewSort, ReviewStatus, ReviewType } from '../enums/testimonial.enums';

// ── Create / update review ────────────────────────────────────────────────
export class CreateReviewDto {
  @ApiPropertyOptional({ enum: ReviewType, default: ReviewType.GENERAL })
  @IsOptional() @IsEnum(ReviewType)
  reviewType?: ReviewType;

  @ApiProperty({ example: 'Found my life partner within 3 months' })
  @IsString() @Length(5, 255)
  title: string;

  @ApiProperty({ example: 'The matchmaking suggestions were spot on and the support team was excellent...' })
  @IsString() @Length(20, 5000)
  reviewText: string;

  @ApiProperty({ example: 5, minimum: 1, maximum: 5 })
  @Type(() => Number) @IsInt() @Min(1) @Max(5)
  overallRating: number;

  @ApiPropertyOptional({ example: 5, minimum: 1, maximum: 5 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(5)
  easeOfUseRating?: number;

  @ApiPropertyOptional({ example: 5, minimum: 1, maximum: 5 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(5)
  matchQualityRating?: number;

  @ApiPropertyOptional({ example: 4, minimum: 1, maximum: 5 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(5)
  communicationRating?: number;

  @ApiPropertyOptional({ example: 5, minimum: 1, maximum: 5 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(5)
  customerSupportRating?: number;

  @ApiPropertyOptional({ example: 5, minimum: 1, maximum: 5 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(5)
  trustSafetyRating?: number;

  @ApiPropertyOptional({ example: 'profile-uuid' })
  @IsOptional() @IsString()
  profileId?: string;
}

// All fields optional; only editable while status === PENDING (enforced in service).
export class UpdateReviewDto extends PartialType(CreateReviewDto) {}

// ── Public listing query ──────────────────────────────────────────────────
export class PublicReviewQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: ReviewType })
  @IsOptional() @IsEnum(ReviewType)
  reviewType?: ReviewType;

  @ApiPropertyOptional({ example: 5, minimum: 1, maximum: 5 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(5)
  rating?: number;

  @ApiPropertyOptional({ enum: ReviewSort, default: ReviewSort.LATEST })
  @IsOptional() @IsEnum(ReviewSort)
  sort?: ReviewSort;

  @ApiPropertyOptional({ example: 'life partner' })
  @IsOptional() @IsString()
  keyword?: string;
}

// ── Reply ──────────────────────────────────────────────────────────────────
export class CreateReplyDto {
  @ApiProperty({ example: 'Congratulations! Wishing you a happy married life.' })
  @IsString() @Length(3, 2000)
  replyText: string;
}

// ── Report ──────────────────────────────────────────────────────────────────
export class ReportReviewDto {
  @ApiProperty({ enum: ReportReason })
  @IsEnum(ReportReason)
  reason: ReportReason;

  @ApiPropertyOptional({ example: 'This review looks fabricated.' })
  @IsOptional() @IsString() @Length(0, 1000)
  comments?: string;
}

// ── Admin actions ────────────────────────────────────────────────────────
export class RejectReviewDto {
  @ApiPropertyOptional({ example: 'Contains promotional content.' })
  @IsOptional() @IsString() @Length(0, 1000)
  adminNotes?: string;
}

export class FeatureReviewDto {
  @ApiProperty({ example: true })
  featured: boolean;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  featuredOrder?: number;
}

export class ResolveReportDto {
  @ApiPropertyOptional({ enum: ReportStatus, default: ReportStatus.RESOLVED })
  @IsOptional() @IsEnum(ReportStatus)
  status?: ReportStatus;
}

// Admin report listing filter.
export class AdminReportsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: ReportStatus })
  @IsOptional() @IsEnum(ReportStatus)
  status?: ReportStatus;
}

// Admin review listing filter — status and/or featured are both optional.
// Omitting status returns every status; omitting featured ignores the flag.
export class AdminReviewListQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: ReviewStatus, description: 'Filter by status; omit for all statuses' })
  @IsOptional() @IsEnum(ReviewStatus)
  status?: ReviewStatus;

  @ApiPropertyOptional({ example: true, description: 'Filter by featured flag' })
  @IsOptional()
  // Preserve undefined (omitted) vs coerce the "true"/"false" query string to a boolean.
  @Transform(({ value }) => (value === undefined ? undefined : value === true || value === 'true'))
  @IsBoolean()
  featured?: boolean;

  @ApiPropertyOptional({ enum: ReviewType, description: 'Filter by review type'})
  @IsOptional()
  @IsEnum(ReviewType)
  reviewType?: ReviewType;
}
