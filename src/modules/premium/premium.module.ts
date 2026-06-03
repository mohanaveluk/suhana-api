import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PremiumController } from './premium.controller';
import { PremiumService } from './premium.service';
import { PremiumPlan, User, UserSubscription } from '../user/entity';

@Module({
  imports: [TypeOrmModule.forFeature([PremiumPlan, User, UserSubscription])],
  controllers: [PremiumController],
  providers: [PremiumService],
  exports: [PremiumService],
})
export class PremiumModule {}
