import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { UploadedImage } from './entity/uploaded-image.entity';
import { ImageController } from './image.controller';
import { ImageService } from './image.service';
import { CloudStorageService } from 'src/common/services/cloud-storage.service';
import { User } from '../user/entity';

@Module({
  imports: [TypeOrmModule.forFeature([UploadedImage, User])],
  controllers: [ImageController],
  providers: [ImageService, CloudStorageService],
  exports: [ImageService],
})
export class ImageModule {}
