import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SuccessStory } from '../entity/success-story.entity';
import { SuccessStoryStatus } from '../enums/testimonial.enums';

@Injectable()
export class SuccessStoryRepository {
  constructor(
    @InjectRepository(SuccessStory)
    private readonly repo: Repository<SuccessStory>,
  ) {}

  create(data: Partial<SuccessStory>): SuccessStory {
    return this.repo.create(data);
  }

  save(story: SuccessStory): Promise<SuccessStory> {
    return this.repo.save(story);
  }

  findById(id: string): Promise<SuccessStory | null> {
    return this.repo.findOne({ where: { id } });
  }

  findPublic(verifiedOnly: boolean, skip: number, take: number): Promise<[SuccessStory[], number]> {
    const qb = this.repo
      .createQueryBuilder('s')
      .where('s.status = :status', { status: SuccessStoryStatus.APPROVED });
    if (verifiedOnly) qb.andWhere('s.verified_marriage = :v', { v: true });
    return qb
      .orderBy('s.verified_marriage', 'DESC')
      .addOrderBy('s.created_at', 'DESC')
      .skip(skip)
      .take(take)
      .getManyAndCount();
  }

  findFeatured(): Promise<SuccessStory[]> {
    return this.repo.find({
      where: { status: SuccessStoryStatus.APPROVED, isFeatured: true },
      // Verified marriages surface first among featured stories.
      order: { verifiedMarriage: 'DESC', createdAt: 'DESC' },
    });
  }

  findPending(skip: number, take: number): Promise<[SuccessStory[], number]> {
    return this.repo.findAndCount({
      where: { status: SuccessStoryStatus.PENDING },
      order: { createdAt: 'ASC' },
      skip,
      take,
    });
  }
}
