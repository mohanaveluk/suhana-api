import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  BadRequestException, ConflictException, GoneException, NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';

import { MobileVerificationService } from './mobile-verification.service';
import { User } from './entity/user.entity';
import { MobileVerificationOtp } from './entity/mobile-verification-otp.entity';
import { MobileVerificationStatus } from './enums/mobile-verification-status.enum';
import { EmailService } from 'src/shared/email/email.service';
import { SmsService } from 'src/shared/sms/sms.service';
import { CustomLoggerService } from '../logger/custom-logger.service';
import { AuditEmitter } from '../audit/audit.emitter';
import { AuditEventType } from '../audit/enums/audit-event-type.enum';

describe('MobileVerificationService', () => {
  let service: MobileVerificationService;
  let userRepo: any;
  let otpRepo: any;
  let smsService: any;
  let emailService: any;
  let auditEmitter: any;

  const MOBILE = '+12105551234';

  const makeUser = (overrides: Partial<User> = {}): any => ({
    id: 'u1',
    email: 'member@example.com',
    first_name: 'Nandhini',
    mobile: MOBILE,
    isMobileVerified: 0,
    is_deleted: false,
    ...overrides,
  });

  // Rate-limit + history both go through createQueryBuilder; getCount drives the limiter.
  const makeQb = (count = 0) => ({
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getCount: jest.fn().mockResolvedValue(count),
    getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
  });

  beforeEach(async () => {
    userRepo = {
      findOne: jest.fn().mockResolvedValue(makeUser()),
      save: jest.fn((x) => Promise.resolve(x)),
    };
    otpRepo = {
      create: jest.fn((x) => x),
      save: jest.fn((x) => Promise.resolve({ id: 'otp1', ...x })),
      findOne: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      createQueryBuilder: jest.fn(() => makeQb(0)),
    };
    smsService = { sendSms: jest.fn().mockResolvedValue(true) };
    emailService = { sendEmail: jest.fn().mockResolvedValue(true) };
    auditEmitter = { emit: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MobileVerificationService,
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: getRepositoryToken(MobileVerificationOtp), useValue: otpRepo },
        { provide: SmsService, useValue: smsService },
        { provide: EmailService, useValue: emailService },
        { provide: CustomLoggerService, useValue: { log: jest.fn(), warn: jest.fn(), error: jest.fn() } },
        { provide: AuditEmitter, useValue: auditEmitter },
      ],
    }).compile();

    service = module.get(MobileVerificationService);
  });

  describe('generateOtp', () => {
    it('always produces exactly 6 digits, including low values', () => {
      for (let i = 0; i < 200; i++) {
        expect(service.generateOtp()).toMatch(/^\d{6}$/);
      }
    });
  });

  describe('sendVerificationOtp', () => {
    it('stores a bcrypt hash rather than the plaintext code, and never returns it', async () => {
      const result = await service.sendVerificationOtp('u1', {});

      expect(result).toEqual({
        success: true,
        message: 'Verification code sent successfully.',
      });
      expect(JSON.stringify(result)).not.toMatch(/\d{6}/);

      const saved = otpRepo.save.mock.calls[0][0];
      expect(saved.otpCode).not.toMatch(/^\d{6}$/);
      expect(saved.otpCode.startsWith('$2')).toBe(true);
      expect(saved.status).toBe(MobileVerificationStatus.PENDING);
      expect(saved.attemptCount).toBe(0);
    });

    it('sends the plaintext code by SMS with a 10-minute expiry notice', async () => {
      await service.sendVerificationOtp('u1', {});

      const sms = smsService.sendSms.mock.calls[0][0];
      expect(sms.to).toBe(MOBILE);
      expect(sms.body).toMatch(/^Your Aurora Matrimony verification code is \d{6}\./);
      expect(sms.body).toContain('expires in 10 minutes');
      expect(sms.body).toContain('Do not share this code');
    });

    it('sets expiresAt 10 minutes out', async () => {
      const before = Date.now();
      await service.sendVerificationOtp('u1', {});
      const saved = otpRepo.save.mock.calls[0][0];

      const deltaMs = saved.expiresAt.getTime() - before;
      expect(deltaMs).toBeGreaterThan(9 * 60_000);
      expect(deltaMs).toBeLessThanOrEqual(10 * 60_000 + 1_000);
    });

    it('expires previous pending codes before issuing a new one', async () => {
      await service.sendVerificationOtp('u1', {});

      expect(otpRepo.update).toHaveBeenCalledWith(
        { userId: 'u1', status: MobileVerificationStatus.PENDING },
        { status: MobileVerificationStatus.EXPIRED },
      );
    });

    it('rejects a number already registered to another account with 409', async () => {
      userRepo.findOne
        .mockResolvedValueOnce(makeUser({ mobile: '+12105550000' })) // caller
        .mockResolvedValueOnce({ id: 'other-user' });                // existing owner

      await expect(
        service.sendVerificationOtp('u1', { mobileNumber: MOBILE }),
      ).rejects.toThrow(ConflictException);

      expect(otpRepo.save).not.toHaveBeenCalled();
      expect(smsService.sendSms).not.toHaveBeenCalled();
    });

    it('resets isMobileVerified to 0 when the number changes', async () => {
      userRepo.findOne
        .mockResolvedValueOnce(makeUser({ mobile: '+12105550000', isMobileVerified: 1 }))
        .mockResolvedValueOnce(null); // number not taken

      await service.sendVerificationOtp('u1', { mobileNumber: MOBILE });

      const savedUser = userRepo.save.mock.calls[0][0];
      expect(savedUser.mobile).toBe(MOBILE);
      expect(savedUser.isMobileVerified).toBe(0);
      expect(auditEmitter.emit).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: AuditEventType.MOBILE_CHANGED }),
      );
    });

    it('refuses to re-send for an already verified number', async () => {
      userRepo.findOne.mockResolvedValue(makeUser({ isMobileVerified: 1 }));

      await expect(service.sendVerificationOtp('u1', {})).rejects.toThrow(
        BadRequestException,
      );
      expect(smsService.sendSms).not.toHaveBeenCalled();
    });

    it('enforces the 3-sends-per-15-minutes rate limit', async () => {
      otpRepo.createQueryBuilder.mockReturnValue(makeQb(3));

      await expect(service.sendVerificationOtp('u1', {})).rejects.toThrow(
        /Too many verification requests/,
      );
      expect(otpRepo.save).not.toHaveBeenCalled();
    });

    it('fails when there is no number on file and none supplied', async () => {
      userRepo.findOne.mockResolvedValue(makeUser({ mobile: null }));

      await expect(service.sendVerificationOtp('u1', {})).rejects.toThrow(
        /No mobile number on file/,
      );
    });

    it('404s for an unknown user', async () => {
      userRepo.findOne.mockResolvedValue(null);

      await expect(service.sendVerificationOtp('nope', {})).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('verifyOtp', () => {
    const pendingOtp = async (overrides: Partial<MobileVerificationOtp> = {}) => ({
      id: 'otp1',
      userId: 'u1',
      mobileNumber: MOBILE,
      otpCode: await bcrypt.hash('482731', 10),
      status: MobileVerificationStatus.PENDING,
      attemptCount: 0,
      expiresAt: new Date(Date.now() + 5 * 60_000),
      ...overrides,
    });

    it('marks the user verified and sends both confirmations on the correct code', async () => {
      otpRepo.findOne.mockResolvedValue(await pendingOtp());

      const result = await service.verifyOtp('u1', {
        mobileNumber: MOBILE,
        otpCode: '482731',
      });

      expect(result).toEqual({
        success: true,
        message: 'Mobile number verified successfully.',
      });

      const savedOtp = otpRepo.save.mock.calls[0][0];
      expect(savedOtp.status).toBe(MobileVerificationStatus.VERIFIED);
      expect(savedOtp.verifiedAt).toBeInstanceOf(Date);

      const savedUser = userRepo.save.mock.calls[0][0];
      expect(savedUser.isMobileVerified).toBe(1);

      expect(smsService.sendSms).toHaveBeenCalledWith(
        expect.objectContaining({ smsType: 'MOBILE_VERIFIED' }),
      );
      expect(emailService.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({ subject: 'Mobile Number Verified Successfully' }),
      );
      expect(auditEmitter.emit).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: AuditEventType.MOBILE_VERIFIED }),
      );
    });

    it('increments attemptCount and reports remaining attempts on a wrong code', async () => {
      otpRepo.findOne.mockResolvedValue(await pendingOtp({ attemptCount: 1 }));

      await expect(
        service.verifyOtp('u1', { mobileNumber: MOBILE, otpCode: '000000' }),
      ).rejects.toThrow(/3 attempts remaining/);

      expect(otpRepo.save.mock.calls[0][0].attemptCount).toBe(2);
      expect(userRepo.save).not.toHaveBeenCalled();
    });

    it('burns the code once the 5th attempt fails', async () => {
      otpRepo.findOne.mockResolvedValue(await pendingOtp({ attemptCount: 4 }));

      await expect(
        service.verifyOtp('u1', { mobileNumber: MOBILE, otpCode: '000000' }),
      ).rejects.toThrow(/Maximum attempts exceeded/);

      const saved = otpRepo.save.mock.calls[0][0];
      expect(saved.attemptCount).toBe(5);
      expect(saved.status).toBe(MobileVerificationStatus.FAILED);
    });

    it('rejects a row already at the attempt ceiling even with the right code', async () => {
      otpRepo.findOne.mockResolvedValue(await pendingOtp({ attemptCount: 5 }));

      await expect(
        service.verifyOtp('u1', { mobileNumber: MOBILE, otpCode: '482731' }),
      ).rejects.toThrow(/Maximum verification attempts exceeded/);

      expect(userRepo.save).not.toHaveBeenCalled();
    });

    it('410s an expired code and marks it EXPIRED', async () => {
      otpRepo.findOne.mockResolvedValue(
        await pendingOtp({ expiresAt: new Date(Date.now() - 1_000) }),
      );

      await expect(
        service.verifyOtp('u1', { mobileNumber: MOBILE, otpCode: '482731' }),
      ).rejects.toThrow(GoneException);

      expect(otpRepo.save.mock.calls[0][0].status).toBe(
        MobileVerificationStatus.EXPIRED,
      );
      expect(userRepo.save).not.toHaveBeenCalled();
    });

    it('404s when no pending code exists', async () => {
      otpRepo.findOne.mockResolvedValue(null);

      await expect(
        service.verifyOtp('u1', { mobileNumber: MOBILE, otpCode: '482731' }),
      ).rejects.toThrow(/No active verification code/);
    });

    it('rejects a number that does not match the account', async () => {
      await expect(
        service.verifyOtp('u1', { mobileNumber: '+19995551234', otpCode: '482731' }),
      ).rejects.toThrow(/does not match the number on your account/);
    });

    it('rejects verification when already verified', async () => {
      userRepo.findOne.mockResolvedValue(makeUser({ isMobileVerified: 1 }));

      await expect(
        service.verifyOtp('u1', { mobileNumber: MOBILE, otpCode: '482731' }),
      ).rejects.toThrow(/already verified/);
    });
  });

  describe('getVerificationStatus', () => {
    it('reports the number and verified flag as a boolean', async () => {
      userRepo.findOne.mockResolvedValue(makeUser({ isMobileVerified: 1 }));

      await expect(service.getVerificationStatus('u1')).resolves.toEqual({
        mobileNumber: MOBILE,
        isMobileVerified: true,
      });
    });

    it('reports false for an unverified number', async () => {
      await expect(service.getVerificationStatus('u1')).resolves.toEqual({
        mobileNumber: MOBILE,
        isMobileVerified: false,
      });
    });
  });
});
