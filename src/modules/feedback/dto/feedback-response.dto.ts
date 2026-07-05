import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { FeedbackCategory } from '../enums/feedback-category.enum';
import { FeedbackStatus } from '../enums/feedback-status.enum';
import { FeedbackType } from '../enums/feedback-type.enum';
import { FeedbackPriority } from '../enums/feedback-priority.enum';

export class FeedbackResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() guid: string;
  @ApiProperty({ enum: FeedbackType }) feedbackType: FeedbackType;
  @ApiProperty({ enum: FeedbackCategory }) category: FeedbackCategory;
  @ApiPropertyOptional() rating: number;
  @ApiProperty() subject: string;
  @ApiProperty() message: string;
  @ApiProperty() submittedByUserId: string;
  @ApiPropertyOptional({ description: 'Null when isAnonymous = true in public context' }) submittedByName: string | null;
  @ApiPropertyOptional() targetUserId: string;
  @ApiPropertyOptional() targetUserName: string;
  @ApiProperty({ enum: FeedbackStatus }) status: FeedbackStatus;
  @ApiProperty() isAnonymous: boolean;
  @ApiProperty() isPublic: boolean;
  @ApiProperty({ enum: FeedbackPriority }) priority: FeedbackPriority;
  @ApiPropertyOptional() adminNotes: string;
  @ApiPropertyOptional() replyMessage: string;
  @ApiPropertyOptional() repliedAt: Date;
  @ApiPropertyOptional() attachmentUrl: string;
  @ApiPropertyOptional() resolvedAt: Date;
  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;
}

export class FeedbackStatsResponseDto {
  @ApiProperty({ example: 100 }) totalFeedback: number;
  @ApiProperty({ example: 10 }) pending: number;
  @ApiProperty({ example: 70 }) approved: number;
  @ApiProperty({ example: 5 }) rejected: number;
  @ApiProperty({ example: 15 }) resolved: number;
  @ApiProperty({ example: 4.5 }) averageRating: number;
  @ApiProperty({ example: 60 }) totalGeneral: number;
  @ApiProperty({ example: 40 }) totalProfile: number;
}

export class PaginatedFeedbackResponseDto {
  @ApiProperty({ type: [FeedbackResponseDto] }) data: FeedbackResponseDto[];
  @ApiProperty({ example: 150 }) total: number;
  @ApiProperty({ example: 1 }) page: number;
  @ApiProperty({ example: 20 }) limit: number;
  @ApiProperty({ example: 8 }) totalPages: number;
}
