import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { SafetyTip } from './entities/safety-tip.entity';
import { SafetyTipsService } from './safety-tips.service';
import { SafetyTipsController } from './safety-tips.controller';
import { SafetyTipsAdminController } from './safety-tips-admin.controller';

@Module({
  imports: [TypeOrmModule.forFeature([SafetyTip])],
  controllers: [SafetyTipsController, SafetyTipsAdminController],
  providers: [SafetyTipsService],
  exports: [SafetyTipsService],
})
export class SafetyTipsModule {}
