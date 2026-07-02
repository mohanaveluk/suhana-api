import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { MatchFixed } from './entity/match-fixed.entity';
import { MatchFixedController } from './match-fixed.controller';
import { MatchFixedPublicController } from './match-fixed-public.controller';
import { MatchFixedAdminController } from './match-fixed-admin.controller';
import { MatchFixedService } from './match-fixed.service';
import { User, Profile } from '../user/entity';

@Module({
  imports: [TypeOrmModule.forFeature([MatchFixed, User, Profile])],
  controllers: [
    MatchFixedController,       // /profile/match-fixed  — authenticated user CRUD
    MatchFixedPublicController,  // /match-fixed/public   — no auth, homepage display
    MatchFixedAdminController,   // /match-fixed/admin    — admin dashboard + partner verify
  ],
  providers: [MatchFixedService],
  exports: [MatchFixedService],
})
export class MatchFixedModule {}
