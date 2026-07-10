import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsUUID, MaxLength } from 'class-validator';

export class SendMessageDto {
  @ApiProperty({
    description: 'Active session UUID returned from POST /chatbot/session',
    example: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
  })
  @IsUUID()
  sessionId: string;

  @ApiProperty({
    description: 'The user\'s question or message',
    example: 'How do I send interest to another profile?',
    maxLength: 2000,
  })
  @IsNotEmpty()
  @IsString()
  @MaxLength(2000)
  message: string;
}
