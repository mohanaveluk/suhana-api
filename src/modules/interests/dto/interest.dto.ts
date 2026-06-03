import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class SendInterestDto {
  @ApiProperty({ description: 'Target user ID to send interest to' })
  @IsNotEmpty() @IsString()
  toUserId: string;

  @ApiPropertyOptional({ description: 'Optional message to include with the interest' })
  @IsOptional() @IsString()
  message?: string;
}
