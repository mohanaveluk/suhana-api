import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Interest } from './entity/interest.entity';
import { InterestsController } from './interests.controller';
import { InterestsService } from './interests.service';
import { User, Profile, Match } from '../user/entity';
import { ChatModule } from '../chat/chat.module';
import { EmailModule } from 'src/shared/email/email.module';
import { LogModule } from '../logger/log.module';

@Module({
  imports: [TypeOrmModule.forFeature([Interest, User, Profile, Match]), ChatModule, LogModule, EmailModule],
  controllers: [InterestsController],
  providers: [InterestsService],
  exports: [InterestsService],
})
export class InterestsModule {}
