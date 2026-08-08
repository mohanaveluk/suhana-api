import { Module } from '@nestjs/common';
import { SmsService } from './sms.service';
import { LogModule } from 'src/modules/logger/log.module';

@Module({
  imports: [LogModule],
  providers: [SmsService],
  exports: [SmsService],
})
export class SmsModule {}
