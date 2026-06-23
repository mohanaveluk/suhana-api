import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmailHistory } from './entity/email-history.entity';
import { EmailHistoryRepository } from './email-history.repository';
import { EmailHistoryService } from './email-history.service';
import { EmailHistoryController } from './email-history.controller';

@Module({
  imports: [TypeOrmModule.forFeature([EmailHistory])],
  controllers: [EmailHistoryController],
  providers: [EmailHistoryService, EmailHistoryRepository],
  exports: [EmailHistoryService],
})
export class EmailHistoryModule {}
