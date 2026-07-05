import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class ReplyFeedbackDto {
  @ApiProperty({
    description: 'Reply message content',
    example: 'Thank you for your feedback. Our team will look into this shortly.',
    maxLength: 2000,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  message: string;
}
