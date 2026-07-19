// src/modules/auth/dto/login-otc.dto.ts

import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, Length, Matches } from 'class-validator';

// ── POST /auth/login/send-otc ─────────────────────────────────────────────────
// Step 1: user submits their email to receive a one-time login code.
export class SendLoginOtcDto {
  @ApiProperty({ example: 'john.doe@example.com' })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @IsNotEmpty()
  email: string;
}

// ── POST /auth/login/validate-otc ─────────────────────────────────────────────
// Step 2: user submits their email + the 6-digit code to complete login.
export class ValidateLoginOtcDto {
  @ApiProperty({ example: 'john.doe@example.com' })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: '123456' })
  @IsString()
  @Length(6, 6, { message: 'Login code must be exactly 6 digits' })
  @Matches(/^\d{6}$/, { message: 'Login code must contain only digits' })
  code: string;
}
