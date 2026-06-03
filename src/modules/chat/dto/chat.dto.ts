import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class SendMessageDto {
  @ApiProperty({ example: 'Hello! How are you?' })
  @IsNotEmpty() @IsString()
  content: string;

  @ApiPropertyOptional({ enum: ['text', 'icebreaker', 'system'], default: 'text' })
  @IsOptional() @IsEnum(['text', 'icebreaker', 'system'])
  type?: string;
}

export class StartConversationDto {
  @ApiProperty({ description: 'User ID of the person to chat with' })
  @IsNotEmpty() @IsString()
  receiverId: string;
}

export class TypingDto {
  @ApiProperty({ description: 'Whether the user is currently typing' })
  isTyping: boolean;
}
