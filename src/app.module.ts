import { Module } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LogModule } from './modules/logger/log.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

import { adminConfig, getDatabaseConfig, googleCloudConfig, jwtConfig, smtpConfig } from './config/configuration';
import { TypeOrmModule } from '@nestjs/typeorm';
import { typeOrmConfig } from './config/typeorm.config';
import { AuditModule } from './modules/audit/audit.module';
import { CommonModule } from './common/common.module';
import { UserModule } from './modules/user/user.module';
import { AuthModule } from './modules/auth/auth.module';
import { ContactModule } from './modules/contact/contact.module';
import { ChatModule } from './modules/chat/chat.module';
import { BlogModule } from './modules/blog/blog.module';
import { CountryModule } from './modules/country/country.module';
import { ProfilesModule } from './modules/profiles/profiles.module';
import { MatchesModule } from './modules/matches/matches.module';
import { ShortlistModule } from './modules/shortlist/shortlist.module';
import { PremiumModule } from './modules/premium/premium.module';
import { AdminModule } from './modules/admin/admin.module';
import { SettingsModule } from './modules/settings/settings.module';
import { GalleryModule } from './modules/gallery/gallery.module';
import { InterestsModule } from './modules/interests/interests.module';
import { CallsModule } from './modules/calls/calls.module';
import { HealthModule } from './modules/health/health.module';
import { LookupModule } from './modules/lookup/lookup.module';
import { EmailHistoryModule } from './modules/email-history/email-history.module';
import { MatchFixedModule } from './modules/match-fixed/match-fixed.module';
import { ImageModule } from './modules/image/image.module';
import { FeedbackModule } from './modules/feedback/feedback.module';
import { ChatbotModule } from './modules/chatbot/chatbot.module';
import { SafetyTipsModule } from './modules/safety-tips/safety-tips.module';

const envFilePath = process.env.NODE_ENV === 'production'
  ? '.env'
  : ['.env', `.env.${process.env.NODE_ENV || 'development'}`];

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath,
      load: [getDatabaseConfig, jwtConfig, adminConfig, googleCloudConfig, smtpConfig],
      isGlobal: true,
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: typeOrmConfig,
    }),
    CommonModule,
    LogModule,
    AuthModule,
    HealthModule,
    AuditModule,
    BlogModule,
    ContactModule,
    CallsModule,
    ChatModule,
    CountryModule,
    GalleryModule,
    InterestsModule,
    ProfilesModule,
    MatchesModule,
    ShortlistModule,
    ChatModule,
    PremiumModule,
    AdminModule,
    SettingsModule,
    UserModule,
    LookupModule,
    EmailHistoryModule,
    MatchFixedModule,
    ImageModule,
    FeedbackModule,
    ChatbotModule,
    SafetyTipsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
  ],
})
export class AppModule {
  // configure(consumer: MiddlewareConsumer) {
  //   consumer.apply(ClinicContextMiddleware).forRoutes('*');
  // }
}