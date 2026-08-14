import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ClinicContext } from 'src/common/context/clinic-context.provider';
import { CommonModule } from 'src/common/common.module';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { UserRepository } from './user.repository';
import { RoleEntity } from './entity/roles.entity';
import { User, UserBlock, UserReport, MobileVerificationOtp } from './entity';

import { MobileVerificationController } from './mobile-verification.controller';
import { AdminMobileVerificationController } from './admin-mobile-verification.controller';
import { MobileVerificationService } from './mobile-verification.service';
import { EmailModule } from 'src/shared/email/email.module';
import { SmsModule } from 'src/shared/sms/sms.module';
import { LogModule } from '../logger/log.module';
import { AuditModule } from '../audit/audit.module';
import { EncryptionService } from 'src/shared/services/encryption.service';

@Module({

  imports: [
    TypeOrmModule.forFeature([User, RoleEntity, UserBlock, UserReport, MobileVerificationOtp]),
    HttpModule,
    CommonModule,
    EmailModule,
    SmsModule,
    LogModule,
    AuditModule,
  ],
  controllers: [
    UserController,
    MobileVerificationController,       // /users/mobile              — authenticated member OTP flow
    AdminMobileVerificationController,  // /admin/mobile-verification — admin audit history
  ],
  providers: [UserRepository, UserService, ClinicContext, MobileVerificationService, EncryptionService],
  exports: [UserService, MobileVerificationService],
})
export class UserModule {}
