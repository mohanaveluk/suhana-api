import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SafetyCategory } from '../enums/safety-category.enum';

export class SafetyTipResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() title: string;
  @ApiProperty() shortDescription: string;
  @ApiProperty() content: string;
  @ApiProperty({ enum: SafetyCategory }) category: SafetyCategory;
  @ApiPropertyOptional() icon: string | null;
  @ApiPropertyOptional() imageUrl: string | null;
  @ApiPropertyOptional() videoUrl: string | null;
  @ApiProperty() displayOrder: number;
  @ApiProperty() isFeatured: boolean;
  @ApiProperty() isPublished: boolean;
  @ApiProperty() viewCount: number;
  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;
}

export class PaginatedSafetyTipsResponseDto {
  @ApiProperty({ type: [SafetyTipResponseDto] }) data: SafetyTipResponseDto[];
  @ApiProperty() total: number;
  @ApiProperty() page: number;
  @ApiProperty() limit: number;
  @ApiProperty() totalPages: number;
}

export class SafetyCategoryResponseDto {
  @ApiProperty({ enum: SafetyCategory }) category: SafetyCategory;
  @ApiProperty() label: string;
  @ApiProperty() count: number;
}
