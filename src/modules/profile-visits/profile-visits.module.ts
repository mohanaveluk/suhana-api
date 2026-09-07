import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { ProfileVisit } from './entities/profile-visit.entity';
import { ProfileVisitsController } from './profile-visits.controller';
import { ProfileVisitsService } from './profile-visits.service';
import { Match, Profile } from '../user/entity';
import { LogModule } from '../logger/log.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ProfileVisit, Profile, Match]),
    LogModule,
  ],
  controllers: [ProfileVisitsController],
  providers: [ProfileVisitsService],
  exports: [ProfileVisitsService],
})
export class ProfileVisitsModule {}
