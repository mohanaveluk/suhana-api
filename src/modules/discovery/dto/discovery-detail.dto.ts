import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { DiscoveryCategoryKind, DiscoveryReviewStatus } from '../constants/discovery.enums';
import { ConsultationMode } from '../constants/discovery.enums';
import { ProviderCardDto, ProviderPlaceDto } from './discovery-search.dto';

export class CategoryDto {
  @ApiProperty() id: number;
  @ApiProperty() slug: string;
  @ApiProperty() name: string;
  @ApiPropertyOptional({ nullable: true }) description: string | null;
  @ApiProperty({ enum: DiscoveryCategoryKind }) kind: DiscoveryCategoryKind;
  @ApiPropertyOptional({ nullable: true }) icon: string | null;
  @ApiPropertyOptional({ nullable: true }) imageUrl: string | null;
  @ApiProperty({ description: 'False = shown as "Coming soon".' }) isActive: boolean;
  @ApiProperty() displayOrder: number;
}

export class ServiceOfferingDto {
  @ApiProperty() id: string;
  @ApiProperty() name: string;
  @ApiPropertyOptional({ nullable: true }) specialization: string | null;
  @ApiProperty({ enum: ConsultationMode }) consultationMode: ConsultationMode;
  @ApiPropertyOptional({ nullable: true, description: 'Null = price on request.' }) price: number | null;
  @ApiPropertyOptional({ nullable: true }) currency: string | null;
  @ApiPropertyOptional({ nullable: true }) durationMinutes: number | null;
  @ApiPropertyOptional({ nullable: true }) description: string | null;
}

export class ProviderLocationDto extends ProviderPlaceDto {
  @ApiProperty() id: string;
  @ApiPropertyOptional({ nullable: true }) label: string | null;
  @ApiProperty() isPrimary: boolean;
}

export class CertificationDto {
  @ApiProperty() name: string;
  @ApiPropertyOptional({ nullable: true }) issuer: string | null;
  @ApiPropertyOptional({ nullable: true }) year: number | null;
  @ApiProperty({ description: 'Credential checked by Aurora (separate from listing verification).' })
  verified: boolean;
}

export class BusinessHoursDto {
  @ApiProperty({ example: 'mon' }) day: string;
  @ApiProperty({ example: '09:00' }) open: string;
  @ApiProperty({ example: '18:00' }) close: string;
}

export class AstrologerDetailDto {
  @ApiPropertyOptional({ nullable: true }) experienceYears: number | null;
  @ApiProperty({ type: [String] }) specializations: string[];
  @ApiProperty({ type: [BusinessHoursDto] }) businessHours: BusinessHoursDto[];
  @ApiProperty({ type: [CertificationDto] }) certifications: CertificationDto[];
  @ApiPropertyOptional({ nullable: true }) availabilityNote: string | null;
}

/** Uniform detail block for every category (astrologers included). */
export class ServiceDetailDto {
  @ApiPropertyOptional({ nullable: true }) experienceYears: number | null;
  @ApiProperty({ type: [String] }) specialties: string[];
  @ApiProperty({ description: 'Typed per category; as stated by the provider.' }) attributes: Record<string, number | boolean | string>;
  @ApiProperty({ type: [BusinessHoursDto] }) businessHours: BusinessHoursDto[];
  @ApiProperty({ type: [CertificationDto] }) certifications: CertificationDto[];
  @ApiPropertyOptional({ nullable: true }) availabilityNote: string | null;
}

export class ProviderMediaDto {
  @ApiProperty() id: string;
  @ApiProperty() url: string;
  @ApiPropertyOptional({ nullable: true }) caption: string | null;
}

export class ProviderDetailDto extends ProviderCardDto {
  @ApiPropertyOptional({ nullable: true }) about: string | null;
  @ApiProperty() verificationStatus: string;
  @ApiPropertyOptional({ nullable: true }) verifiedAt: Date | null;
  @ApiProperty({ type: [ProviderLocationDto] }) locations: ProviderLocationDto[];
  @ApiProperty({ type: [ServiceOfferingDto] }) services: ServiceOfferingDto[];
  @ApiProperty({ type: [ProviderMediaDto] }) gallery: ProviderMediaDto[];
  @ApiPropertyOptional({ type: AstrologerDetailDto, nullable: true }) astrologerDetail: AstrologerDetailDto | null;
  @ApiPropertyOptional({ type: ServiceDetailDto, nullable: true }) serviceDetail: ServiceDetailDto | null;
  @ApiProperty({ description: 'Contact channels that exist (values via POST /contact).' })
  contactChannels: { phone: boolean; email: boolean; website: boolean };
  @ApiProperty({ description: 'Admin-managed listing with no owner — the business may claim it via the provider portal.' })
  claimable: boolean;
}

export class ProviderContactDto {
  @ApiPropertyOptional({ nullable: true }) phone: string | null;
  @ApiPropertyOptional({ nullable: true }) email: string | null;
  @ApiPropertyOptional({ nullable: true }) website: string | null;
}

// ── Reviews ───────────────────────────────────────────────────────────────

export class CreateDiscoveryReviewDto {
  @ApiProperty({ minimum: 1, maximum: 5 })
  @Type(() => Number) @IsInt() @Min(1) @Max(5)
  rating: number;

  @ApiPropertyOptional({ maxLength: 150 })
  @IsOptional() @IsString() @MaxLength(150)
  title?: string;

  @ApiProperty({ minLength: 20, maxLength: 2000 })
  @IsString() @IsNotEmpty() @MinLength(20) @MaxLength(2000)
  comment: string;
}

export class DiscoveryReviewDto {
  @ApiProperty() id: string;
  @ApiProperty() rating: number;
  @ApiPropertyOptional({ nullable: true }) title: string | null;
  @ApiProperty() comment: string;
  @ApiProperty({ description: 'First name + last initial only.' }) authorName: string;
  @ApiProperty() createdAt: Date;
  @ApiProperty({ enum: DiscoveryReviewStatus }) status: DiscoveryReviewStatus;
  @ApiProperty() isMine: boolean;
}

export class DiscoveryReviewListDto {
  @ApiProperty({ type: [DiscoveryReviewDto] }) items: DiscoveryReviewDto[];
  @ApiProperty() total: number;
  @ApiProperty() page: number;
  @ApiProperty() limit: number;
  @ApiProperty() totalPages: number;
  @ApiPropertyOptional({ type: DiscoveryReviewDto, nullable: true, description: "The caller's own review in any status." })
  myReview: DiscoveryReviewDto | null;
}

export class ReviewListQueryDto {
  @ApiPropertyOptional({ default: 1 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 10, maximum: 50 }) @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50)
  limit?: number;
}

export class FavoritesQueryDto extends ReviewListQueryDto {}
