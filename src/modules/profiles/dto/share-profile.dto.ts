import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsEmail, IsNotEmpty, IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

export class ShareProfileDto {
  @ApiProperty({ description: 'Name of the recipient', example: 'Priya' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  receiverName: string;

  @ApiProperty({ description: 'Recipient email addresses', example: ['priya@example.com'] })
  @IsArray()
  @IsEmail({}, { each: true })
  toEmail: string[];

  @ApiProperty({ description: 'Full URL of the profile to share', example: 'https://suhana.com/profiles/abc123' })
  @IsNotEmpty()
  @IsString()
  shareUrl: string;

  @ApiPropertyOptional({ description: 'Email subject override' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  subject?: string;

  @ApiPropertyOptional({ description: 'Optional personal message to include in the email' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  body?: string;
}
