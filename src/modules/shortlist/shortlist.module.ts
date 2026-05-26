import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ShortlistController } from './shortlist.controller';
import { ShortlistService } from './shortlist.service';
import { Match } from '../user/entity';

@Module({
  imports: [TypeOrmModule.forFeature([Match])],
  controllers: [ShortlistController],
  providers: [ShortlistService],
  exports: [ShortlistService],
})
export class ShortlistModule {}
