import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Faq } from '../entities/faq.entity';
import { ChatbotCategory } from '../enums/chatbot-category.enum';
import { SearchFaqDto } from '../dto/search-faq.dto';

@Injectable()
export class FaqRepository {
  constructor(
    @InjectRepository(Faq)
    private readonly repo: Repository<Faq>,
  ) {}

  async findMatchingFaqs(message: string): Promise<Faq[]> {
    const words = message
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 3)
      .slice(0, 8);

    const qb = this.repo
      .createQueryBuilder('f')
      .where('f.isActive = :isActive', { isActive: true });

    if (words.length > 0) {
      const conditions = words
        .map((_, i) => `(LOWER(f.question) LIKE :w${i} OR LOWER(f.keywords) LIKE :w${i})`)
        .join(' OR ');
      const params = words.reduce<Record<string, string>>(
        (acc, w, i) => ({ ...acc, [`w${i}`]: `%${w}%` }),
        {},
      );
      qb.andWhere(`(${conditions})`, params);
    }

    return qb.orderBy('f.displayOrder', 'ASC').take(10).getMany();
  }

  async findByCategory(category: ChatbotCategory, excludeId?: string, limit = 3): Promise<Faq[]> {
    const qb = this.repo
      .createQueryBuilder('f')
      .where('f.isActive = :isActive', { isActive: true })
      .andWhere('f.category = :category', { category });

    if (excludeId) {
      qb.andWhere('f.id != :excludeId', { excludeId });
    }

    return qb.orderBy('RAND()').take(limit).getMany();
  }

  async search(dto: SearchFaqDto): Promise<[Faq[], number]> {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;
    const skip = (page - 1) * limit;

    const qb = this.repo
      .createQueryBuilder('f')
      .where('f.isActive = :isActive', { isActive: true });

    if (dto.category) {
      qb.andWhere('f.category = :category', { category: dto.category });
    }

    if (dto.query) {
      qb.andWhere(
        '(LOWER(f.question) LIKE :q OR LOWER(f.keywords) LIKE :q OR LOWER(f.answer) LIKE :q)',
        { q: `%${dto.query.toLowerCase()}%` },
      );
    }

    return qb.orderBy('f.displayOrder', 'ASC').skip(skip).take(limit).getManyAndCount();
  }

  async findById(id: string): Promise<Faq | null> {
    return this.repo.findOne({ where: { id } });
  }

  async getOrThrow(id: string): Promise<Faq> {
    const faq = await this.repo.findOne({ where: { id } });
    if (!faq) throw new NotFoundException('FAQ not found');
    return faq;
  }
}
