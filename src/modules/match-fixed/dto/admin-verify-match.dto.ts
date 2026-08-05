import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class AdminVerifyMatchDto {
  @ApiPropertyOptional({
    description:
      'Free-text note recording why the admin accepted this match as genuine ' +
      '(e.g. "Wedding invitation confirmed over phone on 12-Jan"). Stored for audit purposes.',
    example: 'Confirmed with the couple over phone; wedding invitation received.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  verificationNote?: string;
}
