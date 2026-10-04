import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Profile } from '../user/entity';
import { LogModule } from '../logger/log.module';
import { AuditModule } from '../audit/audit.module';
import { PersonalityQuestion } from './entities/personality-question.entity';
import { PersonalityQuestionOption } from './entities/personality-question-option.entity';
import { PersonalityAssessment } from './entities/personality-assessment.entity';
import { PersonalityResponse } from './entities/personality-response.entity';
import { PersonalityController } from './personality.controller';
import { PersonalityService } from './personality.service';
import { PERSONALITY_COMPATIBILITY_PROVIDER } from './compatibility/personality-compatibility-provider.interface';
import { RuleBasedCompatibilityProvider } from './compatibility/rule-based-compatibility.provider';

/**
 * Aurora Personality Assessment.
 *
 * Compatibility analysis is bound through PERSONALITY_COMPATIBILITY_PROVIDER,
 * so moving to an AI analyser (e.g. Claude, using the module-level Anthropic
 * factory pattern from MatchesModule) means implementing
 * PersonalityCompatibilityProvider and changing this one binding.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      PersonalityQuestion,
      PersonalityQuestionOption,
      PersonalityAssessment,
      PersonalityResponse,
      Profile,
    ]),
    LogModule,
    AuditModule,
  ],
  controllers: [PersonalityController],
  providers: [
    PersonalityService,
    {
      provide: PERSONALITY_COMPATIBILITY_PROVIDER,
      useClass: RuleBasedCompatibilityProvider,
    },
  ],
  exports: [PersonalityService],
})
export class PersonalityModule {}
