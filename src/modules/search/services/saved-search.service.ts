import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { SavedSearch } from '../entities/saved-search.entity';
import { SavedSearchItemDto } from '../dto/ai-search.dto';
import { SearchIntent } from '../models/search-intent.model';

@Injectable()
export class SavedSearchService {
  /** Guards against a member filling the table; also keeps the list UI usable. */
  private static readonly MAX_PER_USER = 50;

  constructor(
    @InjectRepository(SavedSearch)
    private readonly savedRepo: Repository<SavedSearch>,
  ) {}

  /**
   * Saves a search, or refreshes it if the same query is already saved.
   *
   * Re-saving updates rather than duplicating: members re-run a search and hit
   * save again expecting one entry, not two.
   */
  async save(
    userId: string,
    query: string,
    name: string | undefined,
    intent: SearchIntent,
    resultCount: number,
  ): Promise<SavedSearchItemDto> {
    const trimmed = query.trim();
    if (!trimmed) throw new BadRequestException('query must not be empty');

    const existing = await this.savedRepo.findOne({
      where: { userId, query: trimmed, isDeleted: false },
    });

    if (existing) {
      existing.name = name?.trim() || existing.name;
      existing.parsedIntent = intent;
      existing.resultCountAtSave = resultCount;
      existing.lastRunAt = new Date();
      return this.toDto(await this.savedRepo.save(existing));
    }

    const count = await this.savedRepo.count({ where: { userId, isDeleted: false } });
    if (count >= SavedSearchService.MAX_PER_USER) {
      throw new BadRequestException(
        `You can save up to ${SavedSearchService.MAX_PER_USER} searches. Delete one to save another.`,
      );
    }

    const saved = await this.savedRepo.save(
      this.savedRepo.create({
        userId,
        name: (name?.trim() || trimmed).slice(0, 200),
        query: trimmed.slice(0, 500),
        parsedIntent: intent,
        resultCountAtSave: resultCount,
        lastRunAt: new Date(),
        isDeleted: false,
      }),
    );

    return this.toDto(saved);
  }

  async list(userId: string): Promise<SavedSearchItemDto[]> {
    const rows = await this.savedRepo.find({
      where: { userId, isDeleted: false },
      order: { createdAt: 'DESC' },
    });
    return rows.map((r) => this.toDto(r));
  }

  async getById(id: string, userId: string): Promise<SavedSearch> {
    const row = await this.savedRepo.findOne({ where: { id, userId, isDeleted: false } });
    if (!row) throw new NotFoundException('Saved search not found');
    return row;
  }

  async remove(id: string, userId: string): Promise<{ success: boolean; message: string }> {
    const row = await this.getById(id, userId);
    row.isDeleted = true;
    await this.savedRepo.save(row);
    return { success: true, message: 'Saved search deleted successfully.' };
  }

  /** Stamps last-run time when a saved search is replayed. */
  async touch(id: string, userId: string): Promise<void> {
    await this.savedRepo.update({ id, userId, isDeleted: false }, { lastRunAt: new Date() });
  }

  private toDto(row: SavedSearch): SavedSearchItemDto {
    return {
      id: row.id,
      guid: row.guid,
      name: row.name,
      query: row.query,
      parsedIntent: row.parsedIntent,
      resultCountAtSave: row.resultCountAtSave,
      lastRunAt: row.lastRunAt,
      createdAt: row.createdAt,
    };
  }
}
