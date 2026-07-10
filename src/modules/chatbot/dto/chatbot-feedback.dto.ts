import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { ChatbotFeedbackRating } from '../enums/chatbot-feedback.enum';

export class SubmitChatbotFeedbackDto {
  @ApiProperty({ description: 'UUID of the chatbot message being rated' })
  @IsUUID()
  messageId: string;

  @ApiProperty({
    enum: ChatbotFeedbackRating,
    description: 'Rating for this response',
    example: ChatbotFeedbackRating.HELPFUL,
  })
  @IsEnum(ChatbotFeedbackRating)
  rating: ChatbotFeedbackRating;

  @ApiPropertyOptional({ description: 'Optional free-text comment', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  comments?: string;
}
