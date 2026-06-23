import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { City } from './entity/city.entity';
import { OccupationTitle } from './entity/occupation-title.entity';
import { EducationLevel } from './entity/education.entity';

export interface LookupItem {
  id: number;
  name: string;
}

export interface MasterDataResponse {
  cities: LookupItem[];
  occupations: LookupItem[];
  educationLevels: LookupItem[];
}

@Injectable()
export class LookupService {
  constructor(
    @InjectRepository(City)
    private readonly cityRepo: Repository<City>,
    @InjectRepository(OccupationTitle)
    private readonly occupationRepo: Repository<OccupationTitle>,
    @InjectRepository(EducationLevel)
    private readonly educationRepo: Repository<EducationLevel>,
  ) {}

  // Called automatically after profile save — stores unique city names (case-insensitive)
  async upsertCity(name: string): Promise<void> {
    const trimmed = name?.trim();
    if (!trimmed) return;

    const exists = await this.cityRepo
      .createQueryBuilder('c')
      .where('LOWER(c.name) = LOWER(:name)', { name: trimmed })
      .getOne();

    if (!exists) {
      await this.cityRepo.save(this.cityRepo.create({ name: trimmed }));
    }
  }

  // Called automatically after profile save — stores unique occupation titles (case-insensitive)
  async upsertOccupation(name: string): Promise<void> {
    const trimmed = name?.trim();
    if (!trimmed) return;

    const exists = await this.occupationRepo
      .createQueryBuilder('o')
      .where('LOWER(o.name) = LOWER(:name)', { name: trimmed })
      .getOne();

    if (!exists) {
      await this.occupationRepo.save(this.occupationRepo.create({ name: trimmed }));
    }
  }

  // Called automatically after profile save — stores unique education level (case-insensitive)
  async upsertEducation(name: string): Promise<void> {
    const trimmed = name?.trim();
    if (!trimmed) return;

    const exists = await this.educationRepo
      .createQueryBuilder('o')
      .where('LOWER(o.name) = LOWER(:name)', { name: trimmed })
      .getOne();

    if (!exists) {
      await this.educationRepo.save(this.educationRepo.create({ name: trimmed }));
    }    
  }

  async getAllCities(): Promise<{ id: number; name: string }[]> {
    return this.cityRepo.find({ order: { name: 'ASC' }, select: ['id', 'name'] });
  }

  async getAllOccupations(): Promise<{ id: number; name: string }[]> {
    return this.occupationRepo.find({ order: { name: 'ASC' }, select: ['id', 'name'] });
  }

  async getAllValues(): Promise<MasterDataResponse> {
    const cities = await this.cityRepo.find({ order: { name: 'ASC' }, select: ['id', 'name'] });
    const occupations = await this.occupationRepo.find({ order: { name: 'ASC' }, select: ['id', 'name'] });
    const educationLevels = await this.educationRepo.find({ order: { name: 'ASC' }, select: ['id', 'name'] });
    return {cities, occupations, educationLevels};
  }
}
