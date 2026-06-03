import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MatchesController } from './matches.controller';
import { MatchesService } from './matches.service';
import { Match, Profile, User } from '../user/entity';
import { Interest } from '../interests/entity/interest.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Match, User, Profile, Interest])],
  controllers: [MatchesController],
  providers: [MatchesService],
  exports: [MatchesService],
})
export class MatchesModule {}
