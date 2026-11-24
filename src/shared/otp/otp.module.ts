import { Module } from '@nestjs/common';
import { LogModule } from 'src/modules/logger/log.module';
import { SmsModule } from '../sms/sms.module';
import { OtpDeliveryService } from './otp-delivery.service';

@Module({
  imports: [SmsModule, LogModule],
  providers: [OtpDeliveryService],
  exports: [OtpDeliveryService, SmsModule],
})
export class OtpModule {}
