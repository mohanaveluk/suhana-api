import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class GuestMessageDto {
  @ApiProperty({
    description: 'The guest\'s question or message',
    example: 'How do I send interest to another profile?',
    maxLength: 2000,
  })
  @IsNotEmpty()
  @IsString()
  @MaxLength(2000)
  message: string;

  @ApiPropertyOptional({
    description: 'Optional client-generated identifier for correlating a guest\'s messages. Not tied to any server-side session record.',
    example: 'guest-session-abc123',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  sessionId?: string;
}
