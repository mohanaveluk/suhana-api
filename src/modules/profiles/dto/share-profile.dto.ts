import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsEmail, IsNotEmpty, IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

export class ShareProfileDto {

  @ApiProperty({ description: 'ID of the profile to share', example: 'abc123' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  profileId?: string;

  @ApiProperty({ description: 'Profile code of the profile to share', example: 'XYZ789' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  profileCode?: string;

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

  @ApiProperty({ description: 'Flag to indicate if the email should be sent as a preview', example: false, default: false })
  @IsOptional()
  @IsBoolean()
  preview?: boolean;
}
