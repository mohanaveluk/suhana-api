import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsEmail, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength,
} from 'class-validator';
import { SUPPORTED_COUNTRY_CODES } from '../constants/discovery.constants';
import { ClaimStatus, ListingStatus, ManagementType } from '../constants/discovery.enums';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const lower = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toLowerCase() : value);
const upper = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim().toUpperCase() : value);
const emptyToNull = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? (value.trim() === '' ? null : value.trim()) : value;

/** "For Providers" self-registration. Creates a user (account_type PROVIDER) + a DRAFT listing. */
export class ProviderRegisterDto {
  @ApiProperty({ example: 'Shaandaar Events' })
  @Transform(trim) @IsString() @IsNotEmpty() @MaxLength(150)
  businessName: string;

  @ApiProperty({ example: 'Anita' })
  @Transform(trim) @IsString() @IsNotEmpty() @MaxLength(100)
  firstName: string;

  @ApiPropertyOptional({ example: 'Sharma' })
  @IsOptional() @Transform(emptyToNull) @IsString() @MaxLength(100)
  lastName?: string | null;

  @ApiProperty()
  @Transform(lower) @IsEmail() @MaxLength(255)
  email: string;

  @ApiProperty({ example: '+91 98400 12345' })
  @Transform(trim) @Matches(/^\+?[0-9 ()-]{7,24}$/, { message: 'mobile must be a valid phone number' })
  mobile: string;

  @ApiProperty({ minLength: 8 })
  @IsString() @MinLength(8) @MaxLength(100)
  @Matches(/^(?=.*[A-Za-z])(?=.*\d).+$/, { message: 'password must contain letters and numbers' })
  password: string;

  @ApiProperty({ example: 'wedding-planner', description: 'Primary Discover category slug.' })
  @IsString() @IsNotEmpty() @MaxLength(64)
  categorySlug: string;

  @ApiProperty({ enum: SUPPORTED_COUNTRY_CODES })
  @Transform(upper) @IsIn(SUPPORTED_COUNTRY_CODES)
  country: string;
}

export class CreateClaimDto {
  @ApiProperty({ description: 'Listing (discovery provider) id.' })
  @IsString() @IsNotEmpty() @MaxLength(36)
  providerId: string;

  @ApiProperty({ description: 'Your role at the business and how we can verify it.', minLength: 20 })
  @Transform(trim) @IsString() @MinLength(20) @MaxLength(1000)
  message: string;

  @ApiPropertyOptional() @IsOptional() @Transform(emptyToNull) @IsString() @MaxLength(150)
  contactName?: string | null;

  @ApiPropertyOptional() @IsOptional() @Transform(emptyToNull)
  @Matches(/^\+?[0-9 ()-]{7,24}$/, { message: 'contactPhone must be a valid phone number' })
  contactPhone?: string | null;

  @ApiPropertyOptional({ description: 'An email at the business domain helps verification.' })
  @IsOptional() @Transform(emptyToNull) @IsEmail() @MaxLength(255)
  businessEmail?: string | null;
}

export class ClaimableQueryDto {
  @ApiProperty({ description: 'Business name contains (min 2 characters).' })
  @Transform(trim) @IsString() @MinLength(2) @MaxLength(80)
  q: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(64)
  category?: string;
}

// ── Admin ─────────────────────────────────────────────────────────────────

export class AdminClaimQueryDto {
  @ApiPropertyOptional({ enum: ClaimStatus }) @IsOptional() @IsIn(Object.values(ClaimStatus))
  status?: ClaimStatus;

  @ApiPropertyOptional({ default: 1 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 20 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)
  limit?: number;
}

export class DecideClaimDto {
  @ApiProperty({ enum: [ClaimStatus.APPROVED, ClaimStatus.REJECTED] })
  @IsIn([ClaimStatus.APPROVED, ClaimStatus.REJECTED])
  status: ClaimStatus.APPROVED | ClaimStatus.REJECTED;

  @ApiPropertyOptional({ description: 'Shown to the claimant. Required when rejecting.' })
  @IsOptional() @Transform(emptyToNull) @IsString() @MaxLength(500)
  note?: string | null;
}

export type ReviewDecision = 'PUBLISH' | 'REQUEST_CHANGES' | 'REJECT';

export class ReviewSubmissionDto {
  @ApiProperty({ enum: ['PUBLISH', 'REQUEST_CHANGES', 'REJECT'] })
  @IsIn(['PUBLISH', 'REQUEST_CHANGES', 'REJECT'])
  decision: ReviewDecision;

  @ApiPropertyOptional({ description: 'Shown to the provider. Required for REQUEST_CHANGES / REJECT.' })
  @IsOptional() @Transform(emptyToNull) @IsString() @MaxLength(500)
  note?: string | null;
}

export class SetManagementDto {
  @ApiProperty({ enum: ManagementType })
  @IsIn(Object.values(ManagementType))
  managementType: ManagementType;

  @ApiPropertyOptional({ description: 'Required for PROVIDER_MANAGED: the verified account that will own the listing.' })
  @IsOptional() @Transform(lower) @IsEmail() @MaxLength(255)
  ownerEmail?: string;
}

export interface ListingOwnerDto {
  userId: string;
  name: string;
  email: string;
  role: string;
}

/** Ownership block added to the admin listing view. */
export interface ListingOwnershipDto {
  managementType: ManagementType;
  listingStatus: ListingStatus;
  reviewNote: string | null;
  submittedAt: Date | null;
  owners: ListingOwnerDto[];
  /** Latest claim's status, or NOT_CLAIMED. */
  claimStatus: ClaimStatus | 'NOT_CLAIMED';
  pendingClaims: number;
}
