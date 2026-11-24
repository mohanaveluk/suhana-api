import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DiscoveryFavorite } from '../entities/discovery-favorite.entity';
import { ProviderCardDto } from '../dto/discovery-search.dto';
import { DiscoverySearchService } from './discovery-search.service';
import { ProviderPresenterService } from './provider-presenter.service';

export interface FavoriteList {
  items: ProviderCardDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Favorites are always scoped to the caller's user id — there is no way to
 * read or change another member's list (IDOR-safe by construction).
 */
@Injectable()
export class DiscoveryFavoritesService {
  constructor(
    @InjectRepository(DiscoveryFavorite) private readonly favoriteRepo: Repository<DiscoveryFavorite>,
    private readonly search: DiscoverySearchService,
    private readonly presenter: ProviderPresenterService,
  ) {}

  async list(userId: string, page = 1, limit = 20): Promise<FavoriteList> {
    const [rows, total] = await this.favoriteRepo.findAndCount({
      where: { userId },
      order: { createdAt: 'DESC', id: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    // Hidden/deleted providers drop out of the cards but still count until
    // the member removes them — the UI shows "no longer available" for the gap.
    const items = await this.presenter.toCards(rows.map((r) => r.providerId), {
      userId,
      categorySlug: null,
      origin: null,
      unit: 'km',
    });
    // No search origin here, so cards carry no distance.
    return { items, total, page, limit, totalPages: Math.max(1, Math.ceil(total / limit)) };
  }

  /** Idempotent: favoriting twice is not an error. */
  async add(userId: string, providerId: string): Promise<{ providerId: string; isFavorite: true }> {
    await this.search.findVisibleProvider(providerId);
    const existing = await this.favoriteRepo.findOne({ where: { userId, providerId } });
    if (!existing) {
      try {
        await this.favoriteRepo.save(this.favoriteRepo.create({ userId, providerId }));
      } catch (e: any) {
        // Concurrent double-click → unique index; already favorited.
        if (e?.code !== 'ER_DUP_ENTRY') throw e;
      }
    }
    return { providerId, isFavorite: true };
  }

  /** Idempotent: removing a non-favorite succeeds. Only ever touches the caller's row. */
  async remove(userId: string, providerId: string): Promise<{ providerId: string; isFavorite: false }> {
    await this.favoriteRepo.delete({ userId, providerId });
    return { providerId, isFavorite: false };
  }
}
