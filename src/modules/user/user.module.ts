import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ClinicContext } from 'src/common/context/clinic-context.provider';
import { CommonModule } from 'src/common/common.module';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { UserRepository } from './user.repository';
import { AuditInterceptor } from '../audit/audit.interceptor';
import { AuditRepository } from '../audit/audit.repository';
import { RoleEntity } from './entity/roles.entity';
import { User, UserBlock, UserReport } from './entity';

@Module({

  imports: [
    TypeOrmModule.forFeature([User, RoleEntity, UserBlock, UserReport]),
    HttpModule,
    CommonModule,
  ],
  controllers: [UserController],
  providers: [UserRepository, UserService, AuditInterceptor, AuditRepository, ClinicContext],
  exports: [UserService ],
})
export class UserModule {}