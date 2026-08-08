import { Body, Controller, Get, Post, Request, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth, ApiBody, ApiOperation, ApiResponse, ApiTags,
} from '@nestjs/swagger';

import { MobileVerificationService, VerificationContext } from './mobile-verification.service';
import {
  MobileVerificationResponseDto,
  MobileVerificationStatusDto,
  SendMobileVerificationDto,
  VerifyMobileOtpDto,
} from './dto/mobile-verification.dto';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';

@ApiTags('Mobile Verification')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('users/mobile')
export class MobileVerificationController {
  constructor(private readonly mobileVerificationService: MobileVerificationService) {}

  // POST /api/v1/users/mobile/send-verification
  @Post('send-verification')
  @ApiOperation({
    summary: 'Send a mobile verification OTP',
    description:
      'Generates a secure 6-digit code and sends it by SMS to the caller\'s mobile number.\n\n' +
      '`mobileNumber` is optional:\n' +
      '- **Omitted** — the code goes to the number already on the account.\n' +
      '- **Supplied and different** — the number is checked for use by another account, ' +
      'then written to the profile with `isMobileVerified` reset to 0, and the code is sent there.\n\n' +
      'Issuing a code expires any previous pending code for the caller, so only the newest code works. ' +
      'The code expires after 10 minutes and is never returned in the response.\n\n' +
      '**Rate limit:** 3 requests per user per 15 minutes.',
  })
  @ApiBody({ type: SendMobileVerificationDto })
  @ApiResponse({
    status: 201,
    description: 'Verification code sent',
    type: MobileVerificationResponseDto,
    schema: { example: { success: true, message: 'Verification code sent successfully.' } },
  })
  @ApiResponse({
    status: 400,
    description:
      'Invalid mobile number format, number already verified, no number on file, ' +
      'or the OTP request rate limit was exceeded',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized — missing or invalid JWT' })
  @ApiResponse({
    status: 409,
    description: 'Mobile number is already registered with another account',
    schema: {
      example: {
        success: false,
        message: 'Mobile number is already registered with another account.',
      },
    },
  })
  sendVerification(
    @Request() req: any,
    @Body() dto: SendMobileVerificationDto,
  ): Promise<MobileVerificationResponseDto> {
    return this.mobileVerificationService.sendVerificationOtp(
      req.user.id,
      dto,
      this.context(req),
    );
  }

  // POST /api/v1/users/mobile/resend-verification
  @Post('resend-verification')
  @ApiOperation({
    summary: 'Resend the mobile verification OTP',
    description:
      'Convenience alias for send-verification. Expires the previous pending code and ' +
      'issues a fresh one to the number already on the account (or to `mobileNumber` if supplied). ' +
      'Subject to the same 3-per-15-minute rate limit.',
  })
  @ApiBody({ type: SendMobileVerificationDto, required: false })
  @ApiResponse({
    status: 201,
    description: 'Verification code resent',
    type: MobileVerificationResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Already verified, no number on file, or rate limit exceeded' })
  @ApiResponse({ status: 401, description: 'Unauthorized — missing or invalid JWT' })
  @ApiResponse({ status: 409, description: 'Mobile number is already registered with another account' })
  resendVerification(
    @Request() req: any,
    @Body() dto: SendMobileVerificationDto,
  ): Promise<MobileVerificationResponseDto> {
    return this.mobileVerificationService.sendVerificationOtp(
      req.user.id,
      dto ?? {},
      this.context(req),
    );
  }

  // POST /api/v1/users/mobile/verify
  @Post('verify')
  @ApiOperation({
    summary: 'Verify a mobile OTP',
    description:
      'Confirms ownership of the mobile number by submitting the 6-digit code received by SMS. ' +
      'On success `isMobileVerified` is set to 1, a confirmation SMS and email are sent, ' +
      'and the code is consumed.\n\n' +
      '**Limits:** the code expires after 10 minutes and allows at most 5 failed attempts, ' +
      'after which a new code must be requested.',
  })
  @ApiBody({ type: VerifyMobileOtpDto })
  @ApiResponse({
    status: 201,
    description: 'Mobile number verified',
    type: MobileVerificationResponseDto,
    schema: { example: { success: true, message: 'Mobile number verified successfully.' } },
  })
  @ApiResponse({
    status: 400,
    description:
      'Invalid code (response states how many attempts remain), attempts exceeded, ' +
      'number already verified, or number does not match the account',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized — missing or invalid JWT' })
  @ApiResponse({ status: 404, description: 'No active verification code — request a new one' })
  @ApiResponse({ status: 410, description: 'Verification code has expired — request a new one' })
  verify(
    @Request() req: any,
    @Body() dto: VerifyMobileOtpDto,
  ): Promise<MobileVerificationResponseDto> {
    return this.mobileVerificationService.verifyOtp(req.user.id, dto, this.context(req));
  }

  // GET /api/v1/users/mobile/status
  @Get('status')
  @ApiOperation({
    summary: 'Check mobile verification status',
    description:
      'Returns the mobile number on the caller\'s account and whether ownership has been verified.',
  })
  @ApiResponse({
    status: 200,
    description: 'Current mobile verification status',
    type: MobileVerificationStatusDto,
    schema: { example: { mobileNumber: '+12105551234', isMobileVerified: true } },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized — missing or invalid JWT' })
  @ApiResponse({ status: 404, description: 'User not found' })
  getStatus(@Request() req: any): Promise<MobileVerificationStatusDto> {
    return this.mobileVerificationService.getVerificationStatus(req.user.id);
  }

  // Captures request metadata for the verification audit trail. Honours
  // X-Forwarded-For first so the real client IP survives Cloud Run's proxy.
  private context(req: any): VerificationContext {
    const forwarded = req.headers?.['x-forwarded-for'];
    const ipAddress =
      (typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : undefined) ||
      req.ip ||
      req.socket?.remoteAddress;

    return { ipAddress, userAgent: req.headers?.['user-agent'] };
  }
}
