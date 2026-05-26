import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GalleryController } from './gallery.controller';
import { GalleryService } from './gallery.service';
import { Gallery } from './entity/gallery.entity';
import { CloudStorageService } from 'src/common/services/cloud-storage.service';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { User } from '../user/entity';

@Module({
  imports: [TypeOrmModule.forFeature([Gallery, User])],
  controllers: [GalleryController],
  providers: [GalleryService, CloudStorageService, JwtAuthGuard],
  exports: [GalleryService],
})
export class GalleryModule {}
