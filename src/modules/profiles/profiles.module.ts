import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProfilesController } from './profiles.controller';
import { ProfilesService } from './profiles.service';
import { Profile, ProfilePhoto, User } from '../user/entity';
import { CloudStorageService } from 'src/common/services/cloud-storage.service';


@Module({
  imports: [TypeOrmModule.forFeature([Profile, ProfilePhoto, User])],
  controllers: [ProfilesController],
  providers: [ProfilesService, CloudStorageService],
  exports: [ProfilesService],
})
export class ProfilesModule {}
