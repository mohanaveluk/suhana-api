import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { City } from './entity/city.entity';
import { OccupationTitle } from './entity/occupation-title.entity';
import { LookupService } from './lookup.service';
import { LookupController } from './lookup.controller';
import { EducationLevel } from './entity/education.entity';

@Module({
  imports: [TypeOrmModule.forFeature([City, OccupationTitle, EducationLevel])],
  controllers: [LookupController],
  providers: [LookupService],
  exports: [LookupService],
})
export class LookupModule {}
