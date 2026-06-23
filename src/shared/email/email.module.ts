import { Module } from '@nestjs/common';
import { EmailService } from './email.service';
import { EmailHistoryModule } from 'src/modules/email-history/email-history.module';

@Module({
  imports: [EmailHistoryModule],
  providers: [EmailService],
  exports: [EmailService],
})
export class EmailModule {}
