import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { UploadedImage } from './entity/uploaded-image.entity';
import { ImageController } from './image.controller';
import { ImageService } from './image.service';
import { CloudStorageService } from 'src/common/services/cloud-storage.service';
import { User } from '../user/entity';
import { LogModule } from '../logger/log.module';

@Module({
  imports: [TypeOrmModule.forFeature([UploadedImage, User]), LogModule],
  controllers: [ImageController],
  providers: [ImageService, CloudStorageService],
  exports: [ImageService],
})
export class ImageModule {}
