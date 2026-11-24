import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Interest } from '../interests/entity/interest.entity';
import { ProfileVisit } from '../profile-visits/entities/profile-visit.entity';
import { Match, Message, Profile, User, UserBlock } from '../user/entity';
import { MatchesModule } from '../matches/matches.module';
import { PersonalityModule } from '../personality/personality.module';
import { MemberInteractionsController } from './member-interactions.controller';
import { MemberInteractionsService } from './member-interactions.service';

/** "My Interests" dashboard — read model over interests, profile visits, messages and compatibility. */
@Module({
  imports: [
    TypeOrmModule.forFeature([Interest, ProfileVisit, Message, Match, User, Profile, UserBlock]),
    MatchesModule,
    PersonalityModule,
  ],
  controllers: [MemberInteractionsController],
  providers: [MemberInteractionsService],
})
export class MemberInteractionsModule {}
