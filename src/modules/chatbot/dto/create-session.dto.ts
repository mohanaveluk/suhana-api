import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateSessionDto {
  @ApiPropertyOptional({ description: 'Optional page or context where the chat was opened', maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  context?: string;
}
