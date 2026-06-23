import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString, IsOptional, IsIn, IsDateString, IsObject, MaxLength,
} from 'class-validator';
import { EmailType, EmailStatus } from '../entity/email-history.entity';

export class CreateEmailHistoryDto {
  @ApiProperty({ enum: EmailType, example: EmailType.INTEREST_SENT })
  @IsString()
  emailType: string;

  @ApiPropertyOptional({ description: 'Sender user UUID' })
  @IsOptional()
  @IsString()
  fromUserId?: string;

  @ApiPropertyOptional({ description: 'Recipient user UUID' })
  @IsOptional()
  @IsString()
  toUserId?: string;

  @ApiProperty({ example: 'noreply@suhana.com' })
  @IsString()
  @MaxLength(255)
  fromEmail: string;

  @ApiProperty({ example: 'user@example.com' })
  @IsString()
  @MaxLength(255)
  toEmail: string;

  @ApiPropertyOptional({ example: 'admin@suhana.com' })
  @IsOptional()
  @IsString()
  ccEmail?: string;

  @ApiProperty({ example: 'Interest Sent' })
  @IsString()
  @MaxLength(500)
  subject: string;

  @ApiProperty({ description: 'Full HTML email body' })
  @IsString()
  htmlContent: string;

  @ApiPropertyOptional({ enum: EmailStatus, default: EmailStatus.SENT })
  @IsOptional()
  @IsString()
  @IsIn(Object.values(EmailStatus))
  status?: string;

  @ApiPropertyOptional({ example: 'ionos' })
  @IsOptional()
  @IsString()
  provider?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  providerMessageId?: string;

  @ApiPropertyOptional({ description: 'ISO datetime when email was sent' })
  @IsOptional()
  @IsDateString()
  sentAt?: string;

  @ApiPropertyOptional({ description: 'Additional metadata (e.g. profileCode, interestId)' })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;

  @ApiPropertyOptional({ description: 'User UUID who triggered this email' })
  @IsOptional()
  @IsString()
  createdBy?: string;
}
