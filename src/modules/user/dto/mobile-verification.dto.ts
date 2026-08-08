import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsInt, IsNotEmpty, IsOptional, IsString, Matches, Max, Min,
} from 'class-validator';
import { MobileVerificationStatus } from '../enums/mobile-verification-status.enum';

// E.164: leading '+', a non-zero country code, then up to 14 more digits.
// Deliberately broader than the legacy US-only /^\+1[0-9]{10}$/ used by
// UpdateUserDto so international members can verify their numbers.
export const E164_REGEX = /^\+[1-9]\d{7,14}$/;

const E164_MESSAGE =
  'Mobile number must be in E.164 format: a leading + followed by country code ' +
  'and subscriber number, e.g. +12105551234';

// Strips spaces, hyphens, brackets and dots before validation so the client may
// post a human-formatted number. Does NOT invent a country code — a number
// without '+' stays invalid rather than being silently assumed to be US.
const normalise = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.replace(/[\s\-().]/g, '') : value;

export class SendMobileVerificationDto {
  @ApiPropertyOptional({
    example: '+12105551234',
    description:
      'Mobile number in E.164 format. Optional — omit it to send a code to the ' +
      'number already on the account. When supplied and different from the current ' +
      'number, the account is updated to this number and its verified flag is reset.',
  })
  @IsOptional()
  @Transform(normalise)
  @IsString()
  @Matches(E164_REGEX, { message: E164_MESSAGE })
  mobileNumber?: string;
}

export class VerifyMobileOtpDto {
  @ApiProperty({
    example: '+12105551234',
    description: 'The mobile number the code was sent to, in E.164 format',
  })
  @IsNotEmpty()
  @Transform(normalise)
  @IsString()
  @Matches(E164_REGEX, { message: E164_MESSAGE })
  mobileNumber: string;

  @ApiProperty({
    example: '482731',
    description: '6-digit verification code received by SMS',
  })
  @IsNotEmpty()
  @IsString()
  @Matches(/^\d{6}$/, { message: 'otpCode must be exactly 6 digits' })
  otpCode: string;
}

export class MobileVerificationStatusDto {
  @ApiPropertyOptional({
    example: '+12105551234',
    description: 'The mobile number currently on the account (null if none set)',
  })
  mobileNumber: string | null;

  @ApiProperty({
    example: true,
    description: 'True once ownership of the above number has been proven via OTP',
  })
  isMobileVerified: boolean;
}

// Generic acknowledgement for the send / resend / verify endpoints.
// The OTP itself is never included.
export class MobileVerificationResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 'Verification code sent successfully.' })
  message: string;
}

// ── Admin history ───────────────────────────────────────────────────────────

export class AdminMobileVerificationQueryDto {
  @ApiPropertyOptional({ description: 'Filter by user ID' })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiPropertyOptional({ description: 'Filter by mobile number (E.164)' })
  @IsOptional()
  @Transform(normalise)
  @IsString()
  mobileNumber?: string;

  @ApiPropertyOptional({ enum: MobileVerificationStatus, description: 'Filter by OTP status' })
  @IsOptional()
  @IsString()
  status?: MobileVerificationStatus;

  @ApiPropertyOptional({ example: 1, default: 1 })
  @IsOptional()
  @Transform(({ value }) => (value === undefined ? undefined : Number(value)))
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ example: 20, default: 20, maximum: 100 })
  @IsOptional()
  @Transform(({ value }) => (value === undefined ? undefined : Number(value)))
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class MobileVerificationHistoryItemDto {
  @ApiProperty({ example: 'uuid-...' })
  id: string;

  @ApiProperty({ example: 'uuid-...' })
  userId: string;

  @ApiProperty({ example: '+12105551234' })
  mobileNumber: string;

  @ApiProperty({ enum: MobileVerificationStatus })
  status: MobileVerificationStatus;

  @ApiProperty({ example: 0 })
  attemptCount: number;

  @ApiProperty()
  expiresAt: Date;

  @ApiPropertyOptional()
  sentAt: Date | null;

  @ApiPropertyOptional()
  verifiedAt: Date | null;

  @ApiPropertyOptional({ example: '203.0.113.7' })
  ipAddress: string | null;

  @ApiPropertyOptional({ example: 'Mozilla/5.0 ...' })
  userAgent: string | null;

  @ApiProperty()
  createdAt: Date;
}

export class PaginatedMobileVerificationHistoryDto {
  @ApiProperty({ type: [MobileVerificationHistoryItemDto] })
  items: MobileVerificationHistoryItemDto[];

  @ApiProperty({ example: 137 })
  total: number;

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 20 })
  limit: number;

  @ApiProperty({ example: 7 })
  totalPages: number;
}
