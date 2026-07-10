import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ChatbotKnowledge } from '../entities/chatbot-knowledge.entity';
import { ChatbotCategory } from '../enums/chatbot-category.enum';
import { CreateKnowledgeDto, UpdateKnowledgeDto } from '../dto/manage-knowledge.dto';
import { SearchFaqDto } from '../dto/search-faq.dto';

@Injectable()
export class ChatbotKnowledgeRepository {
  constructor(
    @InjectRepository(ChatbotKnowledge)
    private readonly repo: Repository<ChatbotKnowledge>,
  ) {}

  async findMatchingKnowledge(message: string): Promise<ChatbotKnowledge[]> {
    const words = message
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 3)
      .slice(0, 8);

    const qb = this.repo
      .createQueryBuilder('k')
      .where('k.isActive = :isActive', { isActive: true });

    if (words.length > 0) {
      const conditions = words
        .map((_, i) => `(LOWER(k.title) LIKE :w${i} OR LOWER(k.tags) LIKE :w${i} OR LOWER(k.content) LIKE :w${i})`)
        .join(' OR ');
      const params = words.reduce<Record<string, string>>(
        (acc, w, i) => ({ ...acc, [`w${i}`]: `%${w}%` }),
        {},
      );
      qb.andWhere(`(${conditions})`, params);
    }

    return qb.take(5).getMany();
  }

  async findByCategory(category: ChatbotCategory, limit = 3): Promise<ChatbotKnowledge[]> {
    return this.repo.find({
      where: { category, isActive: true },
      take: limit,
    });
  }

  async search(dto: SearchFaqDto): Promise<[ChatbotKnowledge[], number]> {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;
    const skip = (page - 1) * limit;

    const qb = this.repo
      .createQueryBuilder('k')
      .where('k.isActive = :isActive', { isActive: true });

    if (dto.category) {
      qb.andWhere('k.category = :category', { category: dto.category });
    }

    if (dto.query) {
      qb.andWhere(
        '(LOWER(k.title) LIKE :q OR LOWER(k.tags) LIKE :q OR LOWER(k.content) LIKE :q)',
        { q: `%${dto.query.toLowerCase()}%` },
      );
    }

    return qb.orderBy('k.createdAt', 'DESC').skip(skip).take(limit).getManyAndCount();
  }

  findAll(): Promise<ChatbotKnowledge[]> {
    return this.repo.find({ order: { category: 'ASC', createdAt: 'DESC' } });
  }

  create(dto: CreateKnowledgeDto): Promise<ChatbotKnowledge> {
    return this.repo.save(this.repo.create({ ...dto, isActive: dto.isActive ?? true }));
  }

  async update(id: string, dto: UpdateKnowledgeDto): Promise<ChatbotKnowledge> {
    const knowledge = await this.getOrThrow(id);
    Object.assign(knowledge, dto);
    return this.repo.save(knowledge);
  }

  async remove(id: string): Promise<void> {
    const knowledge = await this.getOrThrow(id);
    await this.repo.remove(knowledge);
  }

  private async getOrThrow(id: string): Promise<ChatbotKnowledge> {
    const knowledge = await this.repo.findOne({ where: { id } });
    if (!knowledge) throw new NotFoundException('Knowledge article not found');
    return knowledge;
  }
}
