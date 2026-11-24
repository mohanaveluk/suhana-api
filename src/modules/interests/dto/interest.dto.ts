import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { INTEREST_SOURCES, InterestSource } from '../entity/interest.entity';

export class SendInterestDto {
  @ApiProperty({ description: 'Target user ID to send interest to' })
  @IsNotEmpty() @IsString()
  toUserId: string;

  @ApiPropertyOptional({ description: 'Optional message to include with the interest' })
  @IsOptional() @IsString() @MaxLength(2000)
  message?: string;

  @ApiPropertyOptional({ enum: INTEREST_SOURCES, description: 'Where the sender found this profile (reporting only)' })
  @IsOptional() @IsIn([...INTEREST_SOURCES])
  source?: InterestSource;
}
