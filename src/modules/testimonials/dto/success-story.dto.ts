import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsISO8601,
  IsOptional,
  IsString,
  IsUrl,
  Length,
} from 'class-validator';
import { PaginationQueryDto } from 'src/common/dto/pagination.dto';

export class CreateSuccessStoryDto {
  @ApiProperty({ example: 'Rahul' })
  @IsString() @Length(1, 150)
  groomName: string;

  @ApiProperty({ example: 'Ananya' })
  @IsString() @Length(1, 150)
  brideName: string;

  @ApiPropertyOptional({ example: 'groom-profile-uuid' })
  @IsOptional() @IsString()
  groomProfileId?: string;

  @ApiPropertyOptional({ example: 'bride-profile-uuid' })
  @IsOptional() @IsString()
  brideProfileId?: string;

  @ApiProperty({ example: 'A match made on Suhana' })
  @IsString() @Length(5, 255)
  title: string;

  @ApiProperty({ example: 'We connected on Suhana in early 2025 and got married the same year...' })
  @IsString() @Length(20, 5000)
  story: string;

  @ApiPropertyOptional({ example: '2025-06-01' })
  @IsOptional() @IsISO8601()
  engagementDate?: string;

  @ApiPropertyOptional({ example: '2025-12-15' })
  @IsOptional() @IsISO8601()
  marriageDate?: string;

  @ApiPropertyOptional({ example: 'https://cdn.suhana.com/stories/couple.jpg' })
  @IsOptional() @IsUrl()
  photoUrl?: string;

  @ApiPropertyOptional({ type: [String], example: ['https://cdn.suhana.com/stories/1.jpg'] })
  @IsOptional() @IsArray() @IsUrl({}, { each: true })
  galleryUrls?: string[];

  @ApiPropertyOptional({ example: 'Chennai, India' })
  @IsOptional() @IsString() @Length(0, 255)
  location?: string;

  // ── Optional Verified Marriage Badge documents ────────────────────────────
  @ApiPropertyOptional({ example: 'https://cdn.suhana.com/stories/wedding.jpg' })
  @IsOptional() @IsUrl()
  weddingPhotoUrl?: string;

  @ApiPropertyOptional({ example: 'https://cdn.suhana.com/stories/invitation.pdf' })
  @IsOptional() @IsUrl()
  weddingInvitationUrl?: string;

  @ApiPropertyOptional({ example: 'https://cdn.suhana.com/stories/certificate.pdf' })
  @IsOptional() @IsUrl()
  marriageCertificateUrl?: string;
}

export class PublicSuccessStoryQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ example: true, description: 'Only verified-marriage stories' })
  @IsOptional()
  verifiedOnly?: boolean;
}

export class VerifyMarriageDto {
  @ApiProperty({ example: true })
  verified: boolean;

  @ApiPropertyOptional({ example: 'Certificate validated against registry.' })
  @IsOptional() @IsString() @Length(0, 1000)
  notes?: string;
}
