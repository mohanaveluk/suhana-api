import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { ChatbotCategory } from '../enums/chatbot-category.enum';

export class CreateKnowledgeDto {
  @ApiProperty({ description: 'Article title', maxLength: 255 })
  @IsNotEmpty()
  @IsString()
  @MaxLength(255)
  title: string;

  @ApiProperty({ enum: ChatbotCategory })
  @IsEnum(ChatbotCategory)
  category: ChatbotCategory;

  @ApiPropertyOptional({
    description: 'Comma-separated tags for search matching',
    example: 'registration,email,otp,verification',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  tags?: string;

  @ApiProperty({ description: 'Full article content' })
  @IsNotEmpty()
  @IsString()
  content: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateKnowledgeDto extends PartialType(CreateKnowledgeDto) {}
