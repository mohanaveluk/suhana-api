import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean, IsEnum, IsOptional, ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

// ── Nested DTOs ──────────────────────────────────────────────────────────────

export class NotificationsDto {
  // Email
  @ApiPropertyOptional({ example: true, description: 'Email alert for new matches' })
  @IsOptional() @IsBoolean()
  emailMatches?: boolean;

  @ApiPropertyOptional({ example: true, description: 'Email alert for new messages' })
  @IsOptional() @IsBoolean()
  emailMessages?: boolean;

  @ApiPropertyOptional({ example: true, description: 'Email alert when someone expresses interest' })
  @IsOptional() @IsBoolean()
  emailInterests?: boolean;

  @ApiPropertyOptional({ example: false, description: 'Marketing & product tip emails' })
  @IsOptional() @IsBoolean()
  emailMarketing?: boolean;

  // Push & SMS
  @ApiPropertyOptional({ example: false, description: 'SMS alerts for important updates' })
  @IsOptional() @IsBoolean()
  smsAlerts?: boolean;

  @ApiPropertyOptional({ example: true, description: 'Push notifications for new matches' })
  @IsOptional() @IsBoolean()
  pushMatches?: boolean;

  @ApiPropertyOptional({ example: true, description: 'Push notifications for new messages' })
  @IsOptional() @IsBoolean()
  pushMessages?: boolean;
}

export class PrivacyDto {
  @ApiPropertyOptional({ example: true, description: 'Show online/active status to others' })
  @IsOptional() @IsBoolean()
  showOnlineStatus?: boolean;

  @ApiPropertyOptional({ example: true, description: 'Show read receipts in chat' })
  @IsOptional() @IsBoolean()
  showReadReceipts?: boolean;

  @ApiPropertyOptional({ example: true, description: 'Include profile in search results' })
  @IsOptional() @IsBoolean()
  profileIndexed?: boolean;

  @ApiPropertyOptional({
    enum: ['everyone', 'matches', 'none'],
    example: 'everyone',
    description: 'Who is allowed to send messages to this user',
  })
  @IsOptional() @IsEnum(['everyone', 'matches', 'none'])
  allowMessageFrom?: 'everyone' | 'matches' | 'none';
}

// ── Top-level DTO ─────────────────────────────────────────────────────────────

export class UpdateSettingsDto {
  @ApiPropertyOptional({ type: NotificationsDto })
  @IsOptional() @ValidateNested()
  @Type(() => NotificationsDto)
  notifications?: NotificationsDto;

  @ApiPropertyOptional({ type: PrivacyDto })
  @IsOptional() @ValidateNested()
  @Type(() => PrivacyDto)
  privacy?: PrivacyDto;
}
