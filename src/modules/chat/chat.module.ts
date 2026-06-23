import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChatController } from './chat.controller';
import Anthropic from '@anthropic-ai/sdk';
import { Conversation, Message, Profile, User } from '../user/entity';
import { ChatService } from './chat.service';
import { CloudStorageService } from 'src/common/services/cloud-storage.service';
import { LogModule } from '../logger/log.module';
import { EmailModule } from 'src/shared/email/email.module';

@Module({
  imports: [TypeOrmModule.forFeature([Conversation, Message, User, Profile])],
  controllers: [ChatController],
  providers: [Anthropic, ChatService, CloudStorageService],
  exports: [ChatService],
})
export class ChatModule {}