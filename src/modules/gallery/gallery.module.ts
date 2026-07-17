import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GalleryController } from './gallery.controller';
import { GalleryService } from './gallery.service';
import { Gallery } from './entity/gallery.entity';
import { CloudStorageService } from 'src/common/services/cloud-storage.service';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { User } from '../user/entity';
import { ImageService } from '../image/image.service';
import { ImageModule } from '../image/image.module';

@Module({
  imports: [TypeOrmModule.forFeature([Gallery, User]), ImageModule],
  controllers: [GalleryController],
  providers: [GalleryService, CloudStorageService, JwtAuthGuard],
  exports: [GalleryService],
})
export class GalleryModule {}
