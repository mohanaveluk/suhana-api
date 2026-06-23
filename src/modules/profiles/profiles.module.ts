import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProfilesController } from './profiles.controller';
import { ProfilesService } from './profiles.service';
import { Profile, ProfilePhoto, User } from '../user/entity';
import { CloudStorageService } from 'src/common/services/cloud-storage.service';
import { LookupModule } from '../lookup/lookup.module';
import { CustomLoggerService } from '../logger/custom-logger.service';
import { LogModule } from '../logger/log.module';
import { EmailService } from 'src/shared/email/email.service';
import { EmailModule } from 'src/shared/email/email.module';


@Module({
  imports: [TypeOrmModule.forFeature([Profile, ProfilePhoto, User]), LookupModule, LogModule, EmailModule],
  controllers: [ProfilesController],
  providers: [ProfilesService, CloudStorageService],
  exports: [ProfilesService],
})
export class ProfilesModule {}
