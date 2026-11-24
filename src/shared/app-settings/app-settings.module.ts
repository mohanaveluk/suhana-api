import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LogModule } from 'src/modules/logger/log.module';
import { CustomLoggerService } from 'src/modules/logger/custom-logger.service';
import { AppSetting } from './entity/app-setting.entity';
import { AppSettingsService } from './app-settings.service';
import { getRepositoryToken } from '@nestjs/typeorm';

@Module({
  imports: [TypeOrmModule.forFeature([AppSetting]), LogModule],
  providers: [
    {
      provide: AppSettingsService,
      useFactory: (repo, logger: CustomLoggerService) => new AppSettingsService(repo, logger),
      inject: [getRepositoryToken(AppSetting), CustomLoggerService],
    },
  ],
  exports: [AppSettingsService],
})
export class AppSettingsModule {}
