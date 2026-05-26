import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';
import { UserSettings } from './entity/user-settings.entity';
import { User } from '../user/entity/user.entity';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';

@Module({
  imports: [TypeOrmModule.forFeature([UserSettings, User])],
  controllers: [SettingsController],
  providers: [SettingsService, JwtAuthGuard],
  exports: [SettingsService],
})
export class SettingsModule {}
