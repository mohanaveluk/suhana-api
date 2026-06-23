import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import Anthropic from '@anthropic-ai/sdk';
import { MatchesController } from './matches.controller';
import { MatchesService } from './matches.service';
import { HoroscopeCompatibilityReport, Match, Profile, User, UserSubscription } from '../user/entity';
import { Interest } from '../interests/entity/interest.entity';
import { InterestsModule } from '../interests/interests.module';
import { EmailModule } from 'src/shared/email/email.module';
import { LogModule } from '../logger/log.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Match, User, Profile, Interest, UserSubscription, HoroscopeCompatibilityReport]),
    InterestsModule,
    EmailModule,
    LogModule,
  ],
  controllers: [MatchesController],
  providers: [
    MatchesService,
    {
      provide: Anthropic,
      useFactory: () => new Anthropic({ apiKey: process.env.CLAUDE_API_KEY }),
    },
  ],
  exports: [MatchesService],
})
export class MatchesModule {}
