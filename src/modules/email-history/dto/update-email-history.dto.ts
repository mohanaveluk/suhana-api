import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsDateString, IsIn } from 'class-validator';
import { EmailStatus } from '../entity/email-history.entity';

export class UpdateEmailHistoryDto {
  @ApiPropertyOptional({ enum: EmailStatus })
  @IsOptional()
  @IsString()
  @IsIn(Object.values(EmailStatus))
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  providerMessageId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  sentAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  openedAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  readAt?: string;
}
