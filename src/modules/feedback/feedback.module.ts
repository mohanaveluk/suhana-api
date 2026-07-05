import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Feedback } from './entity/feedback.entity';
import { FeedbackController } from './feedback.controller';
import { FeedbackService } from './feedback.service';
import { FeedbackRepository } from './feedback.repository';
import { EmailModule } from 'src/shared/email/email.module';
import { User } from '../user/entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Feedback, User]),
    EmailModule,
  ],
  controllers: [FeedbackController],
  providers: [FeedbackService, FeedbackRepository],
  exports: [FeedbackService],
})
export class FeedbackModule {}
