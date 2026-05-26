import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChatController } from './chat.controller';
import Anthropic from '@anthropic-ai/sdk';
import { Conversation, Message } from '../user/entity';
import { ChatService } from './chat.service';


@Module({
  imports: [TypeOrmModule.forFeature([Conversation, Message])],
  controllers: [ChatController],
  providers: [Anthropic, ChatService],
  exports: [ChatService],
})
export class ChatModule {}