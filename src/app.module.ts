import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
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


@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: `.env.${process.env.NODE_ENV || 'development'}`,
      load: [getDatabaseConfig, jwtConfig, adminConfig, googleCloudConfig, smtpConfig],
      isGlobal: true,
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: typeOrmConfig,
    }),
    CommonModule,
    AuthModule,
    AuditModule,
    UserModule,
    ContactModule,
    ChatModule,
    BlogModule,
    CountryModule,
    ProfilesModule,
    MatchesModule,
    ShortlistModule,
    ChatModule,
    PremiumModule,
    AdminModule,
    SettingsModule,
    GalleryModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {
  // configure(consumer: MiddlewareConsumer) {
  //   consumer.apply(ClinicContextMiddleware).forRoutes('*');
  // }
}