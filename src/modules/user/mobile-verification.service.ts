import {
  BadRequestException, ConflictException, GoneException,
  Injectable, NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import { randomInt } from 'crypto';
import * as bcrypt from 'bcrypt';

import { User } from './entity/user.entity';
import { MobileVerificationOtp } from './entity/mobile-verification-otp.entity';
import { MobileVerificationStatus } from './enums/mobile-verification-status.enum';
import {
  AdminMobileVerificationQueryDto,
  MobileVerificationHistoryItemDto,
  MobileVerificationResponseDto,
  MobileVerificationStatusDto,
  PaginatedMobileVerificationHistoryDto,
  SendMobileVerificationDto,
  VerifyMobileOtpDto,
} from './dto/mobile-verification.dto';

import { EmailService } from 'src/shared/email/email.service';
import { SmsService } from 'src/shared/sms/sms.service';
import { mobileVerifiedEmailTemplate } from 'src/shared/email/templates/mobile-verified.template';
import { EmailType } from '../email-history/entity/email-history.entity';
import { CustomLoggerService } from '../logger/custom-logger.service';
import { AuditEmitter } from '../audit/audit.emitter';
import { AuditEventType } from '../audit/enums/audit-event-type.enum';
import { AuditEntityType } from '../audit/enums/audit-entity-type.enum';

// Request-scoped context captured for the verification audit trail.
export interface VerificationContext {
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class MobileVerificationService {
  // Policy constants — referenced by Swagger docs and tests, keep them together.
  static readonly OTP_LENGTH = 6;
  static readonly OTP_TTL_MINUTES = 10;
  static readonly MAX_ATTEMPTS = 5;
  static readonly RATE_LIMIT_MAX_SENDS = 3;
  static readonly RATE_LIMIT_WINDOW_MINUTES = 15;

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(MobileVerificationOtp)
    private readonly otpRepo: Repository<MobileVerificationOtp>,
    private readonly smsService: SmsService,
    private readonly emailService: EmailService,
    private readonly logger: CustomLoggerService,
    private readonly auditEmitter: AuditEmitter,
  ) {}

  // ---------------------------------------------------------------------------
  // API 1 / 4 — send (and resend) a verification OTP
  // ---------------------------------------------------------------------------

  async sendVerificationOtp(
    userId: string,
    dto: SendMobileVerificationDto,
    ctx: VerificationContext = {},
  ): Promise<MobileVerificationResponseDto> {
    const user = await this.userRepo.findOne({ where: { id: userId, is_deleted: false } });
    if (!user) throw new NotFoundException('User not found');

    // The DTO's @Transform already stripped separators; @Matches guaranteed E.164.
    const requested = dto.mobileNumber?.trim();
    const target = requested || user.mobile?.trim();

    if (!target) {
      throw new BadRequestException(
        'No mobile number on file. Provide mobileNumber to set and verify one.',
      );
    }

    // Rate limit before doing any work — cheap guard, and it must apply to
    // resends of the same number too.
    await this.assertWithinSendRateLimit(userId);

    const isChanging = requested !== undefined && requested !== user.mobile;

    if (isChanging) {
      await this.assertMobileNotTaken(target, userId);

      const previous = user.mobile ?? null;
      user.mobile = target;
      // A new number is unproven — force re-verification.
      user.isMobileVerified = 0;
      user.updated_at = new Date();
      await this.userRepo.save(user);

      this.auditEmitter.emit({
        eventType: AuditEventType.MOBILE_CHANGED,
        entityType: AuditEntityType.USER,
        entityId: user.id,
        userId: user.id,
        oldValue: { mobile: previous, isMobileVerified: 1 },
        newValue: { mobile: target, isMobileVerified: 0 },
        description: 'Mobile number changed via mobile verification request',
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
      });
    } else if (user.isMobileVerified === 1) {
      throw new BadRequestException('This mobile number is already verified.');
    }

    // At most one PENDING code per user at any time.
    await this.invalidatePreviousOtps(userId);

    const code = this.generateOtp();
    const now = new Date();

    const record = this.otpRepo.create({
      userId: user.id,
      mobileNumber: target,
      otpCode: await bcrypt.hash(code, 10),
      status: MobileVerificationStatus.PENDING,
      attemptCount: 0,
      expiresAt: new Date(
        now.getTime() + MobileVerificationService.OTP_TTL_MINUTES * 60_000,
      ),
      sentAt: now,
      ipAddress: ctx.ipAddress ?? null,
      userAgent: ctx.userAgent ?? null,
      createdBy: user.id,
    });
    await this.otpRepo.save(record);

    await this.sendVerificationSms(target, code);

    this.auditEmitter.emit({
      eventType: AuditEventType.MOBILE_VERIFICATION_SENT,
      entityType: AuditEntityType.USER,
      entityId: user.id,
      userId: user.id,
      description: `Verification code sent to ${this.mask(target)}`,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });

    return { success: true, message: 'Verification code sent successfully.' };
  }

  // ---------------------------------------------------------------------------
  // API 2 — verify the submitted OTP
  // ---------------------------------------------------------------------------

  async verifyOtp(
    userId: string,
    dto: VerifyMobileOtpDto,
    ctx: VerificationContext = {},
  ): Promise<MobileVerificationResponseDto> {
    const user = await this.userRepo.findOne({ where: { id: userId, is_deleted: false } });
    if (!user) throw new NotFoundException('User not found');

    const mobileNumber = dto.mobileNumber.trim();

    if (user.mobile !== mobileNumber) {
      throw new BadRequestException(
        'This mobile number does not match the number on your account.',
      );
    }
    if (user.isMobileVerified === 1) {
      throw new BadRequestException('This mobile number is already verified.');
    }

    // Newest PENDING code for this user + number.
    const record = await this.otpRepo.findOne({
      where: {
        userId,
        mobileNumber,
        status: MobileVerificationStatus.PENDING,
      },
      order: { createdAt: 'DESC' },
    });

    if (!record) {
      throw new NotFoundException(
        'No active verification code found. Please request a new code.',
      );
    }

    if (record.expiresAt.getTime() <= Date.now()) {
      record.status = MobileVerificationStatus.EXPIRED;
      await this.otpRepo.save(record);
      // 410 Gone — the resource existed but is no longer usable.
      throw new GoneException(
        'Verification code has expired. Please request a new code.',
      );
    }

    // Guard before comparing, so a row already at the ceiling can never be used.
    if (record.attemptCount >= MobileVerificationService.MAX_ATTEMPTS) {
      record.status = MobileVerificationStatus.FAILED;
      await this.otpRepo.save(record);
      throw new BadRequestException(
        'Maximum verification attempts exceeded. Please request a new code.',
      );
    }

    const matches = await bcrypt.compare(dto.otpCode, record.otpCode);

    if (!matches) {
      record.attemptCount += 1;
      const remaining =
        MobileVerificationService.MAX_ATTEMPTS - record.attemptCount;

      // Burn the code once the ceiling is hit — no further guesses on this row.
      if (remaining <= 0) record.status = MobileVerificationStatus.FAILED;
      await this.otpRepo.save(record);

      this.auditEmitter.emit({
        eventType: AuditEventType.MOBILE_VERIFICATION_FAILED,
        entityType: AuditEntityType.USER,
        entityId: user.id,
        userId: user.id,
        description:
          `Incorrect verification code for ${this.mask(mobileNumber)} ` +
          `(attempt ${record.attemptCount}/${MobileVerificationService.MAX_ATTEMPTS})`,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent,
      });

      throw new BadRequestException(
        remaining > 0
          ? `Invalid verification code. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`
          : 'Invalid verification code. Maximum attempts exceeded — please request a new code.',
      );
    }

    // ── Success ──────────────────────────────────────────────────────────────
    const verifiedAt = new Date();

    record.status = MobileVerificationStatus.VERIFIED;
    record.verifiedAt = verifiedAt;
    await this.otpRepo.save(record);

    user.isMobileVerified = 1;
    user.updated_at = verifiedAt;
    await this.userRepo.save(user);

    // Notifications are best-effort — a delivery failure must not undo the
    // verification the user just completed.
    await this.sendConfirmationSms(mobileNumber);
    await this.sendVerificationEmail(user, mobileNumber, verifiedAt);

    this.auditEmitter.emit({
      eventType: AuditEventType.MOBILE_VERIFIED,
      entityType: AuditEntityType.USER,
      entityId: user.id,
      userId: user.id,
      oldValue: { isMobileVerified: 0 },
      newValue: { isMobileVerified: 1 },
      description: `Mobile number ${this.mask(mobileNumber)} verified successfully`,
      ipAddress: ctx.ipAddress,
      userAgent: ctx.userAgent,
    });

    return { success: true, message: 'Mobile number verified successfully.' };
  }

  // ---------------------------------------------------------------------------
  // API 3 — current verification status
  // ---------------------------------------------------------------------------

  async getVerificationStatus(userId: string): Promise<MobileVerificationStatusDto> {
    const user = await this.userRepo.findOne({
      where: { id: userId, is_deleted: false },
      select: ['id', 'mobile', 'isMobileVerified'],
    });
    if (!user) throw new NotFoundException('User not found');

    return {
      mobileNumber: user.mobile ?? null,
      isMobileVerified: user.isMobileVerified === 1,
    };
  }

  // ---------------------------------------------------------------------------
  // Admin — verification history
  // ---------------------------------------------------------------------------

  async getVerificationHistory(
    query: AdminMobileVerificationQueryDto,
  ): Promise<PaginatedMobileVerificationHistoryDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const qb = this.otpRepo.createQueryBuilder('o');
    if (query.userId) qb.andWhere('o.user_id = :userId', { userId: query.userId });
    if (query.mobileNumber) {
      qb.andWhere('o.mobile_number = :mobileNumber', { mobileNumber: query.mobileNumber });
    }
    if (query.status) qb.andWhere('o.status = :status', { status: query.status });

    const [rows, total] = await qb
      .orderBy('o.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      items: rows.map((r) => this.toHistoryItem(r)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // ---------------------------------------------------------------------------
  // Building blocks — public so they can be unit-tested in isolation
  // ---------------------------------------------------------------------------

  /**
   * Expires every outstanding PENDING code for a user. Called before issuing a
   * new one so only the latest code is ever usable.
   */
  async invalidatePreviousOtps(userId: string): Promise<void> {
    await this.otpRepo.update(
      { userId, status: MobileVerificationStatus.PENDING },
      { status: MobileVerificationStatus.EXPIRED },
    );
  }

  /**
   * Cryptographically secure 6-digit code. randomInt is used rather than
   * Math.random so codes are not predictable from prior codes.
   */
  generateOtp(): string {
    const max = 10 ** MobileVerificationService.OTP_LENGTH;
    return randomInt(0, max).toString().padStart(MobileVerificationService.OTP_LENGTH, '0');
  }

  async sendVerificationSms(mobileNumber: string, code: string): Promise<boolean> {
    return this.smsService.sendSms({
      to: mobileNumber,
      smsType: 'MOBILE_VERIFICATION',
      body:
        `Your Aurora Matrimony verification code is ${code}.\n\n` +
        `This code expires in ${MobileVerificationService.OTP_TTL_MINUTES} minutes.\n` +
        `Do not share this code with anyone.`,
    });
  }

  async sendConfirmationSms(mobileNumber: string): Promise<boolean> {
    return this.smsService.sendSms({
      to: mobileNumber,
      smsType: 'MOBILE_VERIFIED',
      body:
        'Your mobile number has been verified successfully.\n\n' +
        'Thank you for verifying your account with Aurora Matrimony.',
    });
  }

  async sendVerificationEmail(
    user: User,
    mobileNumber: string,
    verifiedAt: Date,
  ): Promise<boolean> {
    if (!user.email) return false;

    try {
      return await this.emailService.sendEmail({
        to: user.email,
        subject: 'Mobile Number Verified Successfully',
        html: mobileVerifiedEmailTemplate({
          firstName: user.first_name,
          mobileNumber,
          verifiedAt,
          domain: this.supportDomain(),
        }),
        history: {
          emailType: EmailType.MOBILE_VERIFIED,
          toUserId: user.id,
          createdBy: user.id,
          metadata: { mobileNumber, verifiedAt: verifiedAt.toISOString() },
        },
      });
    } catch (error: any) {
      // EmailService already swallows send errors; this guards template/render faults.
      this.logger.error(
        `Failed to send mobile verification confirmation email to user ${user.id}: ${error?.message}`,
        error?.stack,
      );
      return false;
    }
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /** Rejects a number already attached to a different (non-deleted) account. */
  private async assertMobileNotTaken(mobileNumber: string, currentUserId: string): Promise<void> {
    const owner = await this.userRepo.findOne({
      where: { mobile: mobileNumber, id: Not(currentUserId), is_deleted: false },
      select: ['id'],
    });
    if (owner) {
      throw new ConflictException('Mobile number is already registered with another account.');
    }
  }

  /**
   * Caps OTP sends per user per rolling window. Enforced against the OTP table
   * rather than in-memory so the limit survives restarts and holds across
   * multiple app instances.
   */
  private async assertWithinSendRateLimit(userId: string): Promise<void> {
    const windowStart = new Date(
      Date.now() - MobileVerificationService.RATE_LIMIT_WINDOW_MINUTES * 60_000,
    );

    const recentSends = await this.otpRepo
      .createQueryBuilder('o')
      .where('o.user_id = :userId', { userId })
      .andWhere('o.created_at >= :windowStart', { windowStart })
      .getCount();

    if (recentSends >= MobileVerificationService.RATE_LIMIT_MAX_SENDS) {
      throw new BadRequestException(
        `Too many verification requests. You may request up to ` +
          `${MobileVerificationService.RATE_LIMIT_MAX_SENDS} codes every ` +
          `${MobileVerificationService.RATE_LIMIT_WINDOW_MINUTES} minutes. Please try again later.`,
      );
    }
  }

  private supportDomain(): string {
    const frontend = process.env.FRONTEND_URL ?? '';
    try {
      return frontend ? new URL(frontend).hostname : 'suhanamatrimony.com';
    } catch {
      return 'suhanamatrimony.com';
    }
  }

  // +12105551234 -> +1210*****34 — keeps full numbers out of logs and audit text.
  private mask(mobile: string): string {
    if (!mobile || mobile.length < 6) return '***';
    return `${mobile.slice(0, 5)}*****${mobile.slice(-2)}`;
  }

  private toHistoryItem(o: MobileVerificationOtp): MobileVerificationHistoryItemDto {
    // otpCode is deliberately never mapped — the hash does not leave the service.
    return {
      id: o.id,
      userId: o.userId,
      mobileNumber: o.mobileNumber,
      status: o.status,
      attemptCount: o.attemptCount,
      expiresAt: o.expiresAt,
      sentAt: o.sentAt,
      verifiedAt: o.verifiedAt,
      ipAddress: o.ipAddress,
      userAgent: o.userAgent,
      createdAt: o.createdAt,
    };
  }
}
