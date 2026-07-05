import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class ApproveFeedbackDto {
  @ApiPropertyOptional({
    description: 'Whether to make this feedback publicly visible on the target profile',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;

  @ApiPropertyOptional({ description: 'Internal admin notes', maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  adminNotes?: string;
}

export class RejectFeedbackDto {
  @ApiPropertyOptional({ description: 'Reason for rejection (stored in adminNotes)', example: 'Spam content' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;

  @ApiPropertyOptional({ description: 'Additional internal admin notes', maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  adminNotes?: string;
}
