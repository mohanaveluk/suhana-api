import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class InitiateCallDto {
  @ApiProperty({ description: 'Conversation ID to associate the call with' })
  @IsNotEmpty() @IsString()
  conversationId: string;

  @ApiProperty({ enum: ['audio', 'video'] })
  @IsEnum(['audio', 'video'])
  type: 'audio' | 'video';
}
