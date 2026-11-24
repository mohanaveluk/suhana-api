import { Injectable } from '@nestjs/common';
import { DiscoverySort } from '../constants/discovery.enums';
import { CategoryHandler } from './category-handler';

/**
 * Fallback for categories without a detail table: only the shared engine's
 * filters and sorts. Experience is unknown, so that sort isn't offered.
 */
@Injectable()
export class GenericCategoryHandler implements CategoryHandler {
  readonly slug = '*';
  readonly supportedSorts = [
    DiscoverySort.RECOMMENDED,
    DiscoverySort.NEAREST,
    DiscoverySort.RATING,
    DiscoverySort.PRICE_ASC,
    DiscoverySort.PRICE_DESC,
  ];

  searchFragment() {
    return { joins: [], joinParams: [], where: [], whereParams: [], experienceExpr: null };
  }

  async loadDetails(): Promise<Map<string, unknown>> {
    return new Map();
  }

  toCardExtras() {
    return {};
  }

  toDetailExtras() {
    return {};
  }

  toAdminInput() {
    return {};
  }

  async saveDetails(): Promise<void> {
    /* nothing category-specific to store */
  }
}
