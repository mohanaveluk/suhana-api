import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Call } from './entity/call.entity';
import { Conversation } from '../user/entity/conversation.entity';
import { UserBlock } from '../user/entity/user-block.entity';
import { User } from '../user/entity/user.entity';
import { CallsController } from './calls.controller';
import { CallsService } from './calls.service';
import { CallsGateway } from './calls.gateway';
import { UserPresenceService } from './presence/user-presence.service';

@Module({
  imports: [TypeOrmModule.forFeature([Call, Conversation, UserBlock, User])],
  controllers: [CallsController],
  providers: [CallsService, UserPresenceService],
  //providers: [CallsService, CallsGateway, UserPresenceService],
  exports: [CallsService],
})
export class CallsModule {}
