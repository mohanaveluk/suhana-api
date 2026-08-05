import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsISO8601,
  Max,
  Min,
} from 'class-validator';
import { AuditEventType } from '../enums/audit-event-type.enum';
import { AuditEntityType } from '../enums/audit-entity-type.enum';
import { RiskLevel } from '../enums/risk-level.enum';

// ── Shared pagination base ────────────────────────────────────────────────
export class PaginationQueryDto {
  @ApiPropertyOptional({ example: 1, minimum: 1, default: 1 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ example: 20, minimum: 1, maximum: 100, default: 20 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)
  limit?: number = 20;
}

// ── API 1: user activity history ──────────────────────────────────────────
export class QueryAuditLogDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: AuditEventType })
  @IsOptional() @IsEnum(AuditEventType)
  eventType?: AuditEventType;

  @ApiPropertyOptional({ example: '2026-01-01T00:00:00.000Z' })
  @IsOptional() @IsISO8601()
  startDate?: string;

  @ApiPropertyOptional({ example: '2026-01-31T23:59:59.999Z' })
  @IsOptional() @IsISO8601()
  endDate?: string;
}

// ── API 4: generic red-flag detector ──────────────────────────────────────
export class RedFlagQueryDto {
  @ApiProperty({ enum: AuditEventType, example: AuditEventType.PROFILE_UPDATED })
  @IsEnum(AuditEventType)
  eventType: AuditEventType;

  @ApiPropertyOptional({ example: 14, description: 'Look-back window in days' })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  days?: number;

  @ApiPropertyOptional({ example: 2, description: 'Look-back window in weeks (used if days omitted)' })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  weeks?: number;

  @ApiProperty({ example: 5, description: 'Count at/above which the flag trips' })
  @Type(() => Number) @IsInt() @Min(1)
  threshold: number;
}

// ── API 6: admin audit search ─────────────────────────────────────────────
export class AdminAuditLogQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ example: '0dc806a8-395d-4149-9830-55e869633490' })
  @IsOptional() @IsString()
  userId?: string;

  @ApiPropertyOptional({ enum: AuditEventType })
  @IsOptional() @IsEnum(AuditEventType)
  eventType?: AuditEventType;

  @ApiPropertyOptional({ enum: AuditEntityType })
  @IsOptional() @IsEnum(AuditEntityType)
  entityType?: AuditEntityType;

  @ApiPropertyOptional({ enum: RiskLevel })
  @IsOptional() @IsEnum(RiskLevel)
  riskLevel?: RiskLevel;

  @ApiPropertyOptional({ example: '2026-01-01T00:00:00.000Z' })
  @IsOptional() @IsISO8601()
  startDate?: string;

  @ApiPropertyOptional({ example: '2026-01-31T23:59:59.999Z' })
  @IsOptional() @IsISO8601()
  endDate?: string;
}

export class TopRedFlagsQueryDto {
  @ApiPropertyOptional({ example: 100, default: 100, maximum: 100 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)
  limit?: number = 100;

  @ApiPropertyOptional({ example: 90, description: 'Analysis look-back window in days', default: 90 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  days?: number = 90;
}

// ── Response shapes (for Swagger) ─────────────────────────────────────────
export class AuditLogItemDto {
  @ApiProperty() id: string;
  @ApiProperty({ nullable: true }) userId: string | null;
  @ApiProperty({ nullable: true }) profileId: string | null;
  @ApiProperty({ enum: AuditEventType }) eventType: AuditEventType;
  @ApiProperty({ enum: AuditEntityType, nullable: true }) entityType: AuditEntityType | null;
  @ApiProperty({ nullable: true }) entityId: string | null;
  @ApiProperty({ nullable: true }) changedFields: string[] | null;
  @ApiProperty({ nullable: true }) description: string | null;
  @ApiProperty({ nullable: true }) ipAddress: string | null;
  @ApiProperty({ nullable: true }) deviceType: string | null;
  @ApiProperty({ nullable: true }) platform: string | null;
  @ApiProperty() riskScore: number;
  @ApiProperty({ enum: RiskLevel }) riskLevel: RiskLevel;
  @ApiProperty() createdAt: Date;
}

export class PaginatedAuditLogDto {
  @ApiProperty({ example: 240 }) total: number;
  @ApiProperty({ example: 1 }) page: number;
  @ApiProperty({ example: 20 }) limit: number;
  @ApiProperty({ type: [AuditLogItemDto] }) items: AuditLogItemDto[];
}

export class TimelineEntryDto {
  @ApiProperty({ example: '2026-01-03' }) date: string;
  @ApiProperty({ type: [AuditLogItemDto] }) events: AuditLogItemDto[];
}

export class RiskFactorDto {
  @ApiProperty({ enum: AuditEventType }) event: AuditEventType;
  @ApiProperty({ example: 12 }) count: number;
  @ApiProperty({ example: 20 }) score: number;
  @ApiProperty({ example: 'Profile modified excessively in a short period.' }) reason: string;
}

export class RiskAnalysisDto {
  @ApiProperty({ example: 72 }) overallRiskScore: number;
  @ApiProperty({ enum: RiskLevel }) riskLevel: RiskLevel;
  @ApiProperty({ example: 43 }) trustScore: number;
  @ApiProperty({ example: 'WATCHLIST' }) trustTier: string;
  @ApiProperty({ type: [RiskFactorDto] }) factors: RiskFactorDto[];
}

export class RedFlagResultDto {
  @ApiProperty({ example: true }) redFlagDetected: boolean;
  @ApiProperty({ example: 7 }) count: number;
  @ApiProperty({ example: 5 }) threshold: number;
  @ApiProperty({ enum: RiskLevel }) riskLevel: RiskLevel;
  @ApiProperty({ example: 'Profile modified excessively in short period.' }) recommendation: string;
}

export class ProfileUpdateTrustDto {
  @ApiProperty({ example: 'uuid' }) userId: string;
  @ApiProperty({ example: 0 }) updateCount: number;
  @ApiProperty({ example: 'GREEN_FLAG' }) trustIndicator: 'GREEN_FLAG' | 'YELLOW_FLAG' | 'RED_FLAG';
}