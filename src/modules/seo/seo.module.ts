import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BlogPost } from '../blog/entities/blog-post.entity';
import { SeoController } from './seo.controller';
import { IndexNowService } from './indexnow.service';

@Module({
  imports: [TypeOrmModule.forFeature([BlogPost])],
  controllers: [SeoController],
  providers: [IndexNowService],
  exports: [IndexNowService],
})
export class SeoModule {}
