import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import Anthropic from '@anthropic-ai/sdk';

import { User } from '../user/entity/user.entity';
import { Profile } from '../user/entity/profile.entity';
import { Interest } from '../interests/entity/interest.entity';

import { ChatbotSession } from './entities/chatbot-session.entity';
import { ChatbotMessage } from './entities/chatbot-message.entity';
import { ChatbotFeedback } from './entities/chatbot-feedback.entity';
import { ChatbotKnowledge } from './entities/chatbot-knowledge.entity';
import { Faq } from './entities/faq.entity';

import { ChatbotSessionRepository } from './repositories/chatbot-session.repository';
import { ChatbotMessageRepository } from './repositories/chatbot-message.repository';
import { FaqRepository } from './repositories/faq.repository';
import { ChatbotKnowledgeRepository } from './repositories/chatbot-knowledge.repository';

import { FaqSearchService } from './services/faq-search.service';
import { KnowledgeSearchService } from './services/knowledge-search.service';
import { MessageSearchService } from './services/message-search.service';

import { ChatbotService } from './chatbot.service';
import { ChatbotController } from './chatbot.controller';
import { ProfileSearchService } from './services/profile-search.service';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ChatbotSession,
      ChatbotMessage,
      ChatbotFeedback,
      ChatbotKnowledge,
      Faq,
      User,
      Profile,
      Interest,
    ]),
    ConfigModule
  ],
  controllers: [ChatbotController],
  providers: [
    {
      provide: Anthropic,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) =>
        new Anthropic({ apiKey: configService.get<string>('CLAUDE_API_KEY') }),
    },
    ChatbotSessionRepository,
    ChatbotMessageRepository,
    FaqRepository,
    ChatbotKnowledgeRepository,
    FaqSearchService,
    KnowledgeSearchService,
    MessageSearchService,
    ProfileSearchService,
    ChatbotService,
  ],
  exports: [ChatbotService],
})
export class ChatbotModule {}
