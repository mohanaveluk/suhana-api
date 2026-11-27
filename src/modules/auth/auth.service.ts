import { Injectable, UnauthorizedException, BadRequestException, NotFoundException, InternalServerErrorException, HttpException, GoneException, ConflictException, ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { TokenService } from './token.service';
import { addMinutes } from 'date-fns';
import { Request } from 'express';
import { User } from '../user/entity/user.entity';
import { PasswordArchive } from '../user/entity/password-archive.entity';
import { RoleEntity } from '../user/entity/roles.entity';
import { OTC } from '../user/entity/otc.entity';
import { DateService } from 'src/shared/services/date.service';
import { StorageService } from 'src/shared/services/storage.service';
import { EmailService } from 'src/shared/email/email.service';
import { CommonService } from 'src/common/common.service';
import { UserLoginHistoryService } from './user-login-history.service';
import { RegisterDto } from './dto/register.dto';
import { verifyEmailTemplate } from 'src/shared/email/templates/verify-email-template';
import { UpdateProfileDto } from '../user/dto/update-profile.dto';
import { VerifyEmailDto } from '../user/dto/verify-email.dto';
import { UserResponseDto } from '../user/dto/user-response.dto';
import { LoginDto } from './dto/login.dto';
import { UpdatePasswordLegacyDto } from '../user/dto/update-password.dto';
import { ValidateOTCDto } from '../user/dto/validate-otc.dto';
import { MobileLoginDto } from './dto/mobile-login.dto';
import { passwordResetTemplate } from 'src/shared/email/templates/password-reset.template';
import { ResetPasswordDto } from '../user/dto/reset-password.dto';
import { ResendEmailDto, ResendOTCDto } from '../user/dto/resend-otc.dto';
import { UpdateUserDto } from '../user/dto/update-user.dto';
import { CustomLoggerService } from '../logger/custom-logger.service';
import { CloudStorageService } from 'src/common/services/cloud-storage.service';
import { PasswordResetToken } from './entity/password-reset-token.entity';
import { LoginOtc } from './entity/login-otc.entity';
import { buildOtpEmailHtml, loginOtpEmailTemplate } from 'src/shared/email/templates/otc-email-templates';
import { ValidateLoginOtcDto } from './dto/login-otc.dto';
import { Profile } from '../user/entity';
import { customAlphabet, nanoid } from 'nanoid';
import { EmailType } from '../email-history/entity/email-history.entity';
import { MoreThanOrEqual } from 'typeorm';
import { OtpDeliveryService } from 'src/shared/otp/otp-delivery.service';
import { OTP_MAX_ATTEMPTS, OTP_RESEND_MAX, OTP_RESEND_WINDOW_MINUTES, generateOtp, otpTtlMinutes } from 'src/shared/otp/otp-policy';
import { isWallClockPast, resolveUserZone, wallClockAfterMinutes } from 'src/shared/utils/user-time.util';
import { AccountRolesService } from '../account-roles/account-roles.service';
import { AccountRole, AccountRoleSource, AppTarget } from '../account-roles/account-role.enum';
import { JoinAsMemberDto } from './dto/join-as-member.dto';


@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Profile) 
    private readonly profileRepo: Repository<Profile>,
    @InjectRepository(PasswordArchive)
    private passwordArchiveRepository: Repository<PasswordArchive>,
    @InjectRepository(RoleEntity)
    private rolesRepository: Repository<RoleEntity>,   
    @InjectRepository(OTC)
    private otcRepository: Repository<OTC>, 
    @InjectRepository(PasswordResetToken)
    private readonly tokenRepo: Repository<PasswordResetToken>,
    @InjectRepository(LoginOtc)
    private readonly loginOtcRepo: Repository<LoginOtc>,

    private jwtService: JwtService,
    private dateService: DateService,
    private tokenService: TokenService,
    private storageService: StorageService,
    private cloudStorageService: CloudStorageService,
    private emailService: EmailService,
    private commonService: CommonService,
    private userLoginHistoryService: UserLoginHistoryService,
    private logger: CustomLoggerService,
    private otpDelivery: OtpDeliveryService,
    private readonly accountRoles: AccountRolesService,
  ) {}

  async register(registerDto: RegisterDto, domain: string) : Promise<Record<string, any>> {
    try {

      const existingUser = await this.userRepository.findOne({
        where: { email: registerDto.email, is_email_verified: true },
      });

      if (existingUser) {
        throw new ConflictException('Email already exist');
      }

      const unverifiedUser = await this.userRepository.findOne({
        where: { email: registerDto.email, is_email_verified: false },
      });

      let role = await this.rolesRepository.findOne({ where: { name: "registered" } });
      if (!role) {
        role = await this.rolesRepository.findOne({ where: { name: 'user' } });
        if (!role) {
          throw new Error('Default role not found');
        }
      }

      const hashedPassword = await bcrypt.hash(registerDto.password, 10);
      const verificationCode = this.generateOTC();
      // 15 minutes from now, as wall-clock time in the registering user's own timezone.
      const userZone = resolveUserZone(registerDto.timezone);
      registerDto.timezone = userZone;
      const verificationCodeExpiry = wallClockAfterMinutes(15, userZone) as unknown as Date;

      const profileCode = await this.generateUniqueProfileCode();

      if(unverifiedUser){
        // Update user properties
        Object.assign(unverifiedUser, registerDto);
        unverifiedUser.password = hashedPassword;
        //store utc datetime to updated_at
        unverifiedUser.updated_at = new Date(await this.dateService.getCurrentDateTime());
        unverifiedUser.updated_at_utc = new Date(await this.dateService.getCurrentDateTimeInUTC());
        unverifiedUser.verification_code = verificationCode;
        unverifiedUser.verification_code_expiry = verificationCodeExpiry;
        unverifiedUser.is_email_verified = false;
        unverifiedUser.is_active = 0;
        unverifiedUser.temp_guid = uuidv4();
      }

      const profile = this.profileRepo.create({
        firstName: registerDto.firstName,
        lastName: registerDto.lastName,
        gender: registerDto.gender,
        age: 0,
        religion: '',
        motherTongue: '',
        city: '',
        state: '',
        educationLevel: '',
        occupationTitle: '',
        status: 'pending',
        profileCode: profileCode
      });

      const userRole = await this.rolesRepository.findOne({ where: { name: 'registered' } });
      const user = unverifiedUser ? unverifiedUser : (this.userRepository.create({
        first_name: registerDto.firstName,
        last_name: registerDto.lastName,
        email: registerDto.email,
        password: hashedPassword,
        mobile: registerDto.mobile,
        gender: registerDto.gender,
        id: uuidv4(),
        role: userRole,
        role_id: role.id,
        created_at: new Date(await this.dateService.getCurrentDateTime()),
        created_at_utc: new Date(await this.dateService.getCurrentDateTimeInUTC()),
        verification_code: verificationCode,
        verification_code_expiry: verificationCodeExpiry,
        is_email_verified: false,
        is_active: 0,
        temp_guid: uuidv4(),
        timezone: registerDto.timezone,
        profile
      }));

      const savedUser = await this.userRepository.save(user);
      // Member registration (Aurora Matrimony) grants the MEMBER application role.
      await this.accountRoles.grant(savedUser.id, AccountRole.MEMBER, AccountRoleSource.MEMBER_REGISTRATION, savedUser.id);
      const token = await this.tokenService.generateTokens(savedUser, userRole);

      // Send verification email
      /*this.logger.debug('Sending email...');
      const userFirstName = savedUser.first_name ? (savedUser.first_name === "" || savedUser.first_name === 'unknown' ? "User": savedUser.first_name) : "User";
      await this.emailService.sendEmail({
        to: user.email,
        subject: 'Aurora - Verify Your Email Address',
        html: verifyEmailTemplate(verificationCode, user.id, userFirstName, domain),
        history: {
          emailType: EmailType.EMAIL_VERIFICATION,
          fromUserId: user.id,
          toUserId: user.id,
          createdBy: user.id          
        }
      });
      this.logger.debug('Email has been sent');*/

      //const detail = {user: savedUser, accessToken: token };
      return { detail: token, user: savedUser, message: 'User registered successfully. Please check your email for verification code.' };
    } catch (err) {
      throw err;
    }
  }

  async updateProfile(userGuid: string, updateProfileDto: UpdateProfileDto) {
    try {
      const user = await this.userRepository.findOne({
        where: { id: userGuid },
      });

      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      // Check if email is being updated and is unique
      if (updateProfileDto.email && updateProfileDto.email !== user.email) {
        const existingUser = await this.userRepository.findOne({
          where: { email: updateProfileDto.email },
        });
        if (existingUser) {
          throw new BadRequestException('Email already exists');
        }
      }

      if(!this.commonService.isNullOrEmpty(updateProfileDto.password)){
        const hashedPassword = await bcrypt.hash(updateProfileDto.password, 10);
        updateProfileDto.password = hashedPassword;
      }

      // A changed mobile number is unproven — clear the verified flag so the
      // user must re-verify via POST /users/mobile/send-verification.
      const mobileChanged =
        !!updateProfileDto.mobile && updateProfileDto.mobile !== user.mobile;

      // Update user properties
      Object.assign(user, updateProfileDto);
      user.updated_at = new Date();

      if (mobileChanged) {
        user.isMobileVerified = 0;
      }

      await this.userRepository.save(user);
      return { message: 'Profile updated successfully', profileImage: user.profile_image };
    } catch (error) {
      throw error;
    }
  }

  
  async verifyEmail(verifyEmailDto: VerifyEmailDto): Promise<{ message: string }> {
    const user = await this.userRepository.findOne({
      where: { id: verifyEmailDto.userGuid }
    });

    if (!user) {
      throw new BadRequestException('Invalid verification link');
    }

    if (user.is_email_verified) {
      return { message: 'Email already verified' };
    }

    // The expiry is stored as wall-clock time in the user's own timezone (users.timezone).
    if (isWallClockPast(user.verification_code_expiry, user.timezone)) {
      throw new HttpException('Verification code has expired. Please request a new verification mail.', 410);
    }

    if (!user.verification_code ||
        user.verification_code !== verifyEmailDto.code) {
      throw new BadRequestException('Invalid or expired verification code');
    }

    user.is_email_verified = true;
    user.verification_code = null;
    user.verification_code_expiry = null;
    user.is_active = 1;
    user.updated_at = new Date();
    await this.userRepository.save(user);

    return { message: 'Email verified successfully' };
  }

  async getAllUsers(): Promise<UserResponseDto[]> {
    const users =  await this.userRepository.find({
        where: { is_active: 1, is_email_verified: true },
    });

    let userResponses = [];
    users.forEach(user => {
      const detail = {
        uguid: user.id,
        firstName: user.first_name,
        lastName: user.last_name,
        email: user.email,
        mobile: user.mobile,
        profileImage: user.profile_image
      };
      userResponses.push(detail);
    });
    return userResponses;
  }
  
  async login(loginDto: LoginDto, req: Request) {
    const user = await this.userRepository.findOne({
      where: { email: loginDto.email, is_deleted: false },
    });

    if (!user) {
      throw new NotFoundException('Oops, Invalid User Id.');
    }

    if (user.is_active == 0 || !user.is_email_verified) {
      throw new UnauthorizedException('Oops, User is disabled or email is not verified.');
    }

    if (!user.is_email_verified) {
      // Generate new verification code if needed
      if (!user.verification_code || isWallClockPast(user.verification_code_expiry, user.timezone)) {
        const verificationCode = this.generateOTC();
        user.timezone = resolveUserZone(user.timezone);
        const verificationCodeExpiry = wallClockAfterMinutes(30, user.timezone) as unknown as Date;

        user.verification_code = verificationCode;
        user.verification_code_expiry = verificationCodeExpiry;
        user.updated_at = new Date();
        const domain = `${req.protocol}://${req.get('host')}`;
        await this.userRepository.save(user);

        // Send verification email
        await this.emailService.sendEmail({
          to: user.email,
          subject: 'Aurora - Verify Your Email Address',
          html: verifyEmailTemplate(verificationCode, user.id, user.first_name, domain),
          history: {
            emailType: EmailType.EMAIL_VERIFICATION,
            fromUserId: user.id,
            toUserId: user.id,
            createdBy: user.id          
          }
        });
      }

      throw new UnauthorizedException('Please verify your email address. A verification code has been sent to your email.');
    }

    const isPasswordValid = await bcrypt.compare(loginDto.password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Oops, Password is incorrect.');
    }

    // Record login
    const loginTime = new Date();
    await this.userLoginHistoryService.recordLogin(
      user.id,
      user.id,
      loginTime,
      req.ip,
      req.headers['user-agent']
    );

    user.last_login = loginTime;
    this.userRepository.save(user);
    /*const payload = { 
      sub: user.uguid, 
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
    };
    
      return {
        status: true,
        access_token: await this.jwtService.signAsync(payload),
        user: {
          id: user.uguid,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
        }      
    };*/
    this.logger.debug(`user: '${user.email}' Logged in successfully, generating tokens...`);
    return this.tokenService.generateTokens(user, user.role ? user.role.name : '');

  }

  // ── Passwordless login STEP 1: send a one-time sign-in code ────────────────
  // Delivered by SMS when the account has a verified mobile and SMS is enabled,
  // otherwise (or if SMS fails) by email — exactly as before.
  // Always resolves with the same generic message regardless of whether the
  // email exists / is eligible / is rate-limited (prevents account-enumeration).
  async sendLoginOtc(email: string, domain: string): Promise<{ message: string }> {
    const genericMessage = 'If this account is registered, a one-time login code has been sent to its email or verified mobile number.';

    const user = await this.userRepository.findOne({
      where: { email, is_deleted: false },
    });

    // Only issue a code to a real, active, verified account — but never reveal
    // which of these conditions failed.
    if (!user || user.is_active === 0 || !user.is_email_verified) {
      return { message: genericMessage };
    }

    if (await this.otcResendLimitReached(this.loginOtcRepo, email)) {
      this.logger.warn(`Login OTC resend limit reached for user ${user.id}`);
      return { message: genericMessage };
    }

    // Invalidate previously-issued, still-unused codes (kept, expired, so resends can be counted)
    await this.loginOtcRepo.update({ email, used: false }, { expiresAt: new Date() });

    const ttl = otpTtlMinutes('LOGIN');
    const code = generateOtp();
    const codeHash = await bcrypt.hash(code, 10);
    const record = await this.loginOtcRepo.save(
      this.loginOtcRepo.create({ email, codeHash, expiresAt: new Date(Date.now() + ttl * 60_000), used: false }),
    );

    const channel = await this.otpDelivery.deliverAccountOtp({
      purpose: 'LOGIN',
      user,
      code,
      ttlMinutes: ttl,
      sendEmail: () => this.emailService.sendEmail({
        to: user.email,
        subject: 'Aurora - Your one-time login code',
        html: loginOtpEmailTemplate({
          otp: code,
          firstName: user.first_name,
          email: user.email,
          expiresInMinutes: ttl,
          domain,
        }),
        history: {
          emailType: EmailType.LOGIN_OTC,
          fromUserId: user.id,
          toUserId: user.id,
          createdBy: user.id,
        },
      }),
    });
    if (channel !== 'email') await this.loginOtcRepo.update(record.id, { channel });

    this.logger.debug(`Login OTC issued for user ${user.id} via ${channel}`);
    return { message: genericMessage };
  }

  /** True when OTP_RESEND_MAX codes were already issued for this email in the window. */
  private async otcResendLimitReached(
    repo: Repository<LoginOtc> | Repository<PasswordResetToken>,
    email: string,
  ): Promise<boolean> {
    const since = new Date(Date.now() - OTP_RESEND_WINDOW_MINUTES * 60_000);
    const count = await (repo as Repository<LoginOtc>).count({ where: { email, createdAt: MoreThanOrEqual(since) } });
    return count >= OTP_RESEND_MAX;
  }

  /**
   * Counts a wrong guess; burns the code once OTP_MAX_ATTEMPTS is reached.
   * Returns the guesses left.
   */
  private async registerFailedOtpAttempt(
    repo: Repository<LoginOtc> | Repository<PasswordResetToken>,
    record: { id: string; attemptCount: number },
  ): Promise<number> {
    const attempts = (record.attemptCount ?? 0) + 1;
    await (repo as Repository<LoginOtc>).update(record.id, {
      attemptCount: attempts,
      ...(attempts >= OTP_MAX_ATTEMPTS ? { expiresAt: new Date() } : {}),
    });
    return Math.max(0, OTP_MAX_ATTEMPTS - attempts);
  }

  // ── Passwordless login STEP 2: validate the code and issue JWT tokens ──────
  async validateLoginOtc(dto: ValidateLoginOtcDto, req: Request) {
    const record = await this.loginOtcRepo.findOne({
      where: { email: dto.email, used: false },
      order: { createdAt: 'DESC' }, // most recent code wins
    });

    if (!record) {
      throw new BadRequestException('Invalid or expired login code.');
    }

    if ((record.attemptCount ?? 0) >= OTP_MAX_ATTEMPTS) {
      throw new BadRequestException('Too many incorrect attempts. Please request a new login code.');
    }

    if (record.expiresAt < new Date()) {
      throw new GoneException('Login code has expired. Please request a new one.');
    }

    const isMatch = await bcrypt.compare(dto.code, record.codeHash);
    if (!isMatch) {
      const left = await this.registerFailedOtpAttempt(this.loginOtcRepo, record);
      throw new BadRequestException(
        left > 0
          ? 'Incorrect login code. Please try again.'
          : 'Too many incorrect attempts. Please request a new login code.',
      );
    }

    // Load the account (with role for the token payload) and re-check eligibility
    const user = await this.userRepository.findOne({
      where: { email: dto.email, is_deleted: false },
      relations: ['role'],
    });
    if (!user || user.is_active === 0 || !user.is_email_verified) {
      throw new UnauthorizedException('Oops, User is disabled or email is not verified.');
    }

    // Consume the code so it cannot be replayed — conditional update, so two
    // concurrent requests with the same code cannot both succeed.
    const consumed = await this.loginOtcRepo.update({ id: record.id, used: false }, { used: true });
    if (!consumed.affected) {
      throw new BadRequestException('Invalid or expired login code.');
    }

    // Record login — mirrors the password login flow
    const loginTime = new Date();
    await this.userLoginHistoryService.recordLogin(
      user.id,
      user.id,
      loginTime,
      req.ip,
      req.headers['user-agent'],
    );
    user.last_login = loginTime;
    await this.userRepository.save(user);

    this.logger.debug(`user: '${user.email}' logged in via OTC, generating tokens...`);
    return this.tokenService.generateTokens(user, user.role ? user.role.name : '');
  }

  async updatePassword_legacy(userGuId: string, updatePasswordDto: UpdatePasswordLegacyDto) {
    const user = await this.userRepository.findOne({
      where: { id: userGuId },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const isCurrentPasswordValid = await bcrypt.compare(
      updatePasswordDto.currentPassword,
      user.password
    );

    if (!isCurrentPasswordValid) {
      throw new ConflictException('Current password is incorrect');
    }

    // Archive the current password
    const passwordArchive = this.passwordArchiveRepository.create({
      password: user.password,
      user_id: user.id,
      user: user
    });
    await this.passwordArchiveRepository.save(passwordArchive);

    // Update to new password
    const hashedNewPassword = await bcrypt.hash(updatePasswordDto.newPassword, 10);
    user.password = hashedNewPassword;
    await this.userRepository.save(user);

    return { message: 'Password updated successfully' };
  }

  async getUserInfo(userGuid: string){
    const user = await this.userRepository.findOne({
      where: { id: userGuid },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    user.password = "";
    return user;
  }

  async logout(userId: string, uguid: string) {
    await this.tokenService.revokeAllUserRefreshTokens(userId.toString());
    await this.userLoginHistoryService.recordLogout(uguid);
    return { message: 'Logged out successfully' };
  }


  async uploadProfileImage(userGuid: string, file: Express.Multer.File): Promise<{ message: string; imageUrl: string }> {
    try {
      const user = await this.userRepository.findOne({
        where: { id: userGuid },
      });

      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      //const imageUrl = await this.storageService.uploadFile(file);
      const imageUrl = await this.cloudStorageService.uploadFile(file);
      
      user.profile_image = imageUrl;
      user.updated_at = new Date();
      await this.userRepository.save(user);

      return {
        message: 'Profile image uploaded successfully',
        imageUrl,
      };
    } catch (error) {
      throw error;
    }
  }


  

  /** 6-digit code for email verification and friends — crypto.randomInt, not Math.random. */
  private generateOTC(): string {
    return generateOtp();
  }

  // ── Legacy mobile-number login (retired) ──────────────────────────────────
  // These endpoints stored plaintext codes, had no attempt limit, revealed whether a
  // number was registered, and validateOTC could create an account and issue a JWT for
  // any number. No client uses them. Routes are kept (contract) but answer 410 Gone.
  // SMS OTP now lives in login/send-otc (verified mobiles) and /users/mobile/*.
  private legacyMobileGone(): never {
    throw new GoneException('Mobile-number login has been retired. Use the one-time login code (email or verified mobile) instead.');
  }

  async sendMobileOTC(_mobile: string): Promise<{ message: string }> {
    this.legacyMobileGone();
  }

  async validateOTC(_dto: ValidateOTCDto): Promise<{ access_token?: string; message: string }> {
    this.legacyMobileGone();
  }

  async loginWithMobile(_dto: MobileLoginDto): Promise<{ message: string }> {
    this.legacyMobileGone();
  }

  private async generateResetToken(userId: string): Promise<string> {
    const payload = { sub: userId, type: 'password_reset' };
    return this.jwtService.sign(payload, { expiresIn: '1h' });
  }
  
  async requestPasswordReset(email: string): Promise<{ message: string }> {
    try {
      const user = await this.userRepository.findOne({
        where: { email },
      });
  
      if (!user) {
        // Return success even if user doesn't exist (security best practice)
        return { message: 'If your email is registered, you will receive password reset instructions' };
      }
  
      const token = await this.generateResetToken(user.id);
      const resetLink = `${process.env.FRONTEND_URL}/auth/reset?token=${token}`;
        // Send password reset email
      this.logger.debug(`Sending email with reset link for user: '${user.email}'`);
      await this.emailService.sendEmail({
        to: user.email,
        subject: 'Aurora - Password Reset Request',
        html: passwordResetTemplate(resetLink),
        history: {
          emailType: EmailType.PASSWORD_RESET,
          fromUserId: user.id,
          toUserId: user.id,
          createdBy: user.id          
        }
      });
  
      return { message: 'If your email is registered, you will receive password reset instructions' };
    } catch (error) {
      throw error;
    }
  }
  
  async resetPassword(resetPasswordDto: ResetPasswordDto): Promise<{ message: string }> {
    try {
      const payload = this.jwtService.verify(resetPasswordDto.token);
      
      if (payload.type !== 'password_reset') {
        throw new BadRequestException('Invalid reset token');
      }
  
      const user = await this.userRepository.findOne({
        where: { id: payload.sub },
      });
  
      if (!user) {
        throw new BadRequestException('Invalid reset token');
      }
  
      // Archive current password
      const passwordArchive = this.passwordArchiveRepository.create({
        password: user.password,
        user_id: user.id,
        user: user
      });
      await this.passwordArchiveRepository.save(passwordArchive);
  
      // Update password
      const hashedPassword = await bcrypt.hash(resetPasswordDto.password, 10);
      user.password = hashedPassword;
      user.updated_at = new Date();
      await this.userRepository.save(user);
      this.logger.debug(`Password reset successfully for user: '${user.email}'`);
      return { message: 'Password reset successfully' };
    } catch (error) {
      const errName = (error && typeof (error as any).name === 'string') ? (error as any).name : null;
      if (errName === 'JsonWebTokenError' || errName === 'TokenExpiredError') {
        throw new BadRequestException('Invalid or expired reset token');
      }
      throw error;
    }
  }

  async resendVerificationCode(resendOTCDto: ResendOTCDto): Promise<{ message: string }>{
    try {
      const user = await this.userRepository.findOne({
        where: { email: resendOTCDto.email },
      });

      if (!user) {
        // Return success even if user doesn't exist (security best practice)
        return { message: 'If your email is registered, you will receive verification code' };
      }
      const verificationCode = this.generateOTC();
      user.timezone = resolveUserZone(user.timezone);
      const verificationCodeExpiry = wallClockAfterMinutes(15, user.timezone) as unknown as Date;

      user.verification_code = verificationCode;
      user.verification_code_expiry = verificationCodeExpiry;
      await this.userRepository.save(user);
      
      // Send verification email
      await this.emailService.sendEmail({
        to: user.email,
        subject: 'Aurora - Verify Your Email Address',
        html: verifyEmailTemplate(verificationCode, user.id, user.first_name, "domain"),
        history: {
          emailType: EmailType.EMAIL_VERIFICATION,
          fromUserId: user.id,
          toUserId: user.id,
          createdBy: user.id          
        }
      });

      return { message: 'The verification code has been sent again. Please check your email for verification code' };

    } catch (error) {
      throw error;
    }
  }

  async resendVerificationMail(resendEmailDto: ResendEmailDto, domain: string): Promise<{ message: string }> {
    try {
      const user = await this.userRepository.findOne({
        where: [
          { id: resendEmailDto.userGuid },
          { email: resendEmailDto.email },
        ],
      });

      if (!user) {
        throw new BadRequestException('User not found');
      }

      if(user.is_email_verified){
        return { message: 'Email already verified' };
      }

      const verificationCode = this.generateOTC();
      // 15 minutes from now in the user's own timezone (a valid zone sent with the request wins).
      user.timezone = resolveUserZone(resendEmailDto.timezone || user.timezone);
      const verificationCodeExpiry = wallClockAfterMinutes(15, user.timezone) as unknown as Date;
      user.verification_code = verificationCode;
      user.verification_code_expiry = verificationCodeExpiry;
      user.updated_at = new Date(await this.dateService.getCurrentDateTime());
      user.updated_at_utc = new Date(await this.dateService.getCurrentDateTimeInUTC());
      
      await this.userRepository.save(user);
      // Send verification email
      
      await this.emailService.sendEmail({
        to: user.email,
        subject: 'Aurora - Verify Your Email Address',
        html: verifyEmailTemplate(verificationCode, user.id, user.first_name, domain),
        history: {
          emailType: EmailType.EMAIL_VERIFICATION,
          fromUserId: user.id,
          toUserId: user.id,
          createdBy: user.id          
        }
        
      });
      
      return { message: 'Verification email sent successfully. Please check your email for verification code' };

    } catch (error) {
      throw error;
    }
  }

  // ── STEP 1: Forgot password — generate and deliver OTP ───────────────────
  // SMS when the account has a verified mobile and SMS is enabled; otherwise
  // (or if SMS fails) email, exactly as before.
  async forgotPassword(email: string): Promise<void> {
    // Look up the user — but DON'T throw if not found (prevents enumeration)
    const user = await this.userRepository.findOne({ where: { email } });
    if (!user) return; // silently return — frontend sees the same 200 either way

    // Silent resend limit — same 200 response, nothing is sent
    if (await this.otcResendLimitReached(this.tokenRepo, email)) {
      this.logger.warn(`Password reset resend limit reached for user ${user.id}`);
      return;
    }

    // Invalidate existing unused tokens (kept, expired, so resends can be counted)
    await this.tokenRepo.update({ email, used: false }, { expiresAt: new Date() });

    const ttl = otpTtlMinutes('PASSWORD_RESET');
    const otp = generateOtp(); // crypto.randomInt

    // Hash the OTP before storing (treat like a password)
    const otpHash = await bcrypt.hash(otp, 10);
    const record = await this.tokenRepo.save(
      this.tokenRepo.create({
        email,
        otpHash,
        resetToken: null,   // populated in step 2 after OTP verified
        expiresAt: new Date(Date.now() + ttl * 60_000),
        used: false,
      }),
    );

    const channel = await this.otpDelivery.deliverAccountOtp({
      purpose: 'PASSWORD_RESET',
      user,
      code: otp,
      ttlMinutes: ttl,
      sendEmail: () => this.emailService.sendEmail({
        to:      email,
        subject: 'Aurora - Your password reset code',
        html:    buildOtpEmailHtml(otp, user.first_name ?? 'there', ttl),
        history: {
          emailType: EmailType.PASSWORD_RESET,
          fromUserId: user.id,
          toUserId: user.id,
          createdBy: user.id
        }
      }),
    });
    if (channel !== 'email') await this.tokenRepo.update(record.id, { channel });
  }


// ── STEP 2: Verify OTP — return a short-lived reset token ────────────────
 
  async verifyResetCode(email: string, code: string): Promise<string> {
    const record = await this.tokenRepo.findOne({
      where: { email, used: false },
      order: { createdAt: 'DESC' }, // use the most recent one
    });
 
    // No record found
    if (!record) {
      throw new BadRequestException('Invalid or expired verification code.');
    }

    if ((record.attemptCount ?? 0) >= OTP_MAX_ATTEMPTS) {
      throw new BadRequestException('Too many incorrect attempts. Please request a new verification code.');
    }

    // Check expiry
    if (record.expiresAt < new Date()) {
      throw new GoneException('Verification code has expired. Please request a new one.');
    }

    // Verify OTP against stored hash
    const isMatch = await bcrypt.compare(code, record.otpHash);
    if (!isMatch) {
      const left = await this.registerFailedOtpAttempt(this.tokenRepo, record);
      throw new BadRequestException(
        left > 0
          ? 'Incorrect verification code. Please try again.'
          : 'Too many incorrect attempts. Please request a new verification code.',
      );
    }
 
    // OTP is valid — generate a reset token (UUID) valid for 10 minutes
    const resetToken  = uuidv4();
    const resetExpiry = new Date(Date.now() + 10 * 60 * 1000);
 
    // Persist the reset token on the same record
    record.resetToken = resetToken;
    record.expiresAt  = resetExpiry;
    await this.tokenRepo.save(record);
 
    return resetToken;
  }
 
  // ── STEP 3: Update password ───────────────────────────────────────────────
 
  async updatePassword(
    email:       string,
    resetToken:  string,
    newPassword: string,
  ): Promise<void> {
    const record = await this.tokenRepo.findOne({
      where: { email, resetToken, used: false },
    });
 
    if (!record) {
      throw new BadRequestException('Invalid or expired reset token.');
    }
 
    if (record.expiresAt < new Date()) {
      throw new GoneException('Reset token has expired. Please restart the reset process.');
    }
 
    const user = await this.userRepository.findOne({ where: { email } });
    if (!user) {
      throw new NotFoundException('User not found.');
    }
 
    // Hash the new password
    const passwordHash = await bcrypt.hash(newPassword, 12);
 
    // Update the user record
    await this.userRepository.update(user.id, { password: passwordHash });
 
    // Mark the token as used so it cannot be replayed
    record.used = true;
    await this.tokenRepo.save(record);
  }  

  /*async getUserPermissions(userId: string): Promise<Permission[]> {
    try {

      const userEntity = await this.userRepository.findOne({
        where: { uguid: userId },
      });

      const user = await this.userRepository.findOne({
        where: { uguid: userId },
        relations: ['groups', 'groups.permissions'] //, 'groups.permissions'
      });

      if (!user) {
        throw new NotFoundException(`User with ID ${userId} not found`);
      }

      // Collect unique permissions from all user groups
      const permissions = new Set<Permission>();
      user.groups.forEach(group => {
        group.permissions.forEach(permission => {
          permissions.add(permission);
        });
      });

      return Array.from(permissions);
    } catch (error) {
      console.log(error);
      throw error;
    }
  }*/
  
  //  user related apis
  async findAllRoles(): Promise<RoleEntity[]> {
    try {
      const roles = await this.rolesRepository.find({
        order: { name: 'ASC' }
      });
      return roles;
    } catch (error) {
      throw new InternalServerErrorException('Failed to fetch users');
    }
  }

  async findAllUsers(): Promise<User[]> {
    try {
      const users = await this.userRepository.find({
        where: { is_deleted: false },
        order: { created_at: 'DESC' },
        relations: ['role']
      });
      return users;
    } catch (error) {
      throw new InternalServerErrorException('Failed to fetch users');
    }
  }
  

  async updateUser(uguid: string, updateUserDto: UpdateUserDto): Promise<User> {
    try {
      const user = await this.userRepository.findOne({
        where: { id: uguid, is_deleted: false },
        relations: ['role']
      });

      if (!user) {
        throw new NotFoundException(`User with ID ${uguid} not found`);
      }

      const role = await this.rolesRepository.findOne({
        where: {guid: updateUserDto.roleGuid}
      });

      // Validate email uniqueness if email is being updated
      if (updateUserDto.email && updateUserDto.email !== user.email) {
        const existingUser = await this.userRepository.findOne({
          where: { email: updateUserDto.email, is_deleted: false }
        });
        if (existingUser) {
          throw new BadRequestException('Email already exists');
        }
      }

      // A changed mobile number is unproven — clear the verified flag so the
      // user must re-verify via POST /users/mobile/send-verification.
      const mobileChanged =
        !!updateUserDto.mobile && updateUserDto.mobile !== user.mobile;

      Object.assign(user, updateUserDto);
      user.role = role;
      user.role_id = role?.id || null;

      if (mobileChanged) {
        user.isMobileVerified = 0;
      }

      return await this.userRepository.save(user);
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to update user');
    }
  }

  async toggleStatus(uguid: string, isActive: boolean): Promise<User> {
    try {
      const user = await this.userRepository.findOne({
        where: { id: uguid, is_deleted: false },
        relations: ['role']
      });

      if (!user) {
        throw new NotFoundException(`User with ID ${uguid} not found`);
      }

      user.is_active = isActive ? 1 : 0;
      user.updated_at = new Date();
      return await this.userRepository.save(user);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerErrorException('Failed to update user status');
    }
  }

  /**
   * An existing, signed-in account without the MEMBER role (e.g. registered on
   * Aurora for Providers) joins Aurora Matrimony with the same identity: no new
   * user is created. Signing in proved ownership; the email must be verified.
   * Creates the matrimony profile shell if there isn't one, sets gender and
   * grants MEMBER. The wizard then saves the details via PATCH /profiles/me.
   * Idempotent: an account that is already a member just gets its roles back.
   */
  /** "Switch Aurora experience": a 60-second single-use code for the other web app. */
  createHandoff(userId: string, target: AppTarget) {
    return this.accountRoles.createHandoff(userId, target);
  }

  /**
   * Burns a handoff code and signs the user in to `target` with a fresh session
   * (same response shape as /auth/login). Tokens are never put in URLs — only the
   * short-lived code is, and it works once.
   */
  async exchangeHandoff(code: string, target: AppTarget) {
    const user = await this.accountRoles.consumeHandoff(code, target);
    this.logger.debug(`Handoff sign-in for user ${user.id} → ${target}`);
    return { data: await this.tokenService.generateTokens(user, user.role ? user.role.name : '') };
  }

  async joinAsMember(userId: string, dto: JoinAsMemberDto): Promise<{ roles: AccountRole[]; tempGuid: string | null }> {
    const user = await this.userRepository.findOne({ where: { id: userId, is_deleted: false }, relations: ['profile'] });
    if (!user) throw new NotFoundException('Account not found');
    if (!user.is_email_verified) throw new ForbiddenException('Verify your email address before creating a matrimony profile.');

    const current = await this.accountRoles.rolesOf(userId);
    if (current.includes(AccountRole.MEMBER)) return { roles: current, tempGuid: user.temp_guid ?? null };

    user.gender = dto.gender as any;
    if (dto.firstName?.trim()) user.first_name = dto.firstName.trim();
    if (dto.lastName?.trim()) user.last_name = dto.lastName.trim();
    if (!user.profile) {
      user.profile = this.profileRepo.create({
        firstName: user.first_name,
        lastName: user.last_name,
        gender: dto.gender as any,
        age: 0,
        religion: '',
        motherTongue: '',
        city: '',
        state: '',
        educationLevel: '',
        occupationTitle: '',
        status: 'pending',
        profileCode: await this.generateUniqueProfileCode(),
      });
    }
    user.temp_guid = user.temp_guid ?? uuidv4();
    user.updated_at = new Date();
    await this.userRepository.save(user);
    await this.accountRoles.grant(userId, AccountRole.MEMBER, AccountRoleSource.MEMBER_JOIN, userId);
    return { roles: await this.accountRoles.rolesOf(userId), tempGuid: user.temp_guid };
  }

  async generateUniqueProfileCode(): Promise<string> {

    let code: string;
    let exists = true;

    while (exists) {
      const nanoid = customAlphabet(
        'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
        8
      );
      code = `M${nanoid()}`;

      const profile = await this.profileRepo.findOne({
        where: {
          profileCode: code
        }
      });

      exists = !!profile;
    }

    return code;
  }
}