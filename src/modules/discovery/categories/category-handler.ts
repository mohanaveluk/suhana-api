import { EntityManager } from 'typeorm';
import { DiscoverySort } from '../constants/discovery.enums';
import { CategorySqlFragment } from '../search/provider-search.query';
import { AstrologerDetailDto, ServiceDetailDto } from '../dto/discovery-detail.dto';
import { AstrologerSummaryDto, CategoryDetailsSummaryDto } from '../dto/discovery-search.dto';
import { AstrologerDetailInputDto, CategoryDetailInputDto } from '../dto/discovery-admin.dto';

/** Category-specific search filters (superset; each handler reads what it understands). */
export interface CategoryFilters {
  specialization?: string[];
  minExperience?: number;
  /** Minimum guest capacity — only for categories with a capacity attribute. */
  minCapacity?: number;
}

/**
 * Category-specific fields merged into the member-facing card / detail.
 * `details` / `serviceDetail` are the uniform shape every category fills;
 * `astrologer` / `astrologerDetail` are kept for existing Phase 1 clients.
 */
export interface CategoryCardExtras {
  astrologer?: AstrologerSummaryDto | null;
  details?: CategoryDetailsSummaryDto | null;
}
export interface CategoryDetailExtras {
  astrologerDetail?: AstrologerDetailDto | null;
  serviceDetail?: ServiceDetailDto | null;
}

/** Category-specific admin input (one optional block per category with detail data). */
export interface CategoryAdminInput {
  astrologer?: AstrologerDetailInputDto;
  /** One entry per non-astrologer category, keyed by categorySlug. */
  categoryDetails?: CategoryDetailInputDto[];
}

/**
 * The seam that keeps Aurora Discover category-driven. The generic engine
 * (search SQL, locations, services, languages, reviews, favorites, admin CRUD)
 * is shared; everything category-specific lives behind this interface:
 *
 *   - extra SQL for search (joins / filters / experience expression)
 *   - which sorts make sense
 *   - loading and mapping the category detail table
 *   - saving admin input for the category detail table
 *
 * Adding marriage halls later = a new handler (+ its detail table if needed),
 * registered in CategoryHandlerRegistry. No changes to the engine.
 */
export interface CategoryHandler {
  readonly slug: string;
  readonly supportedSorts: DiscoverySort[];
  searchFragment(filters: CategoryFilters): CategorySqlFragment;
  /** Detail rows keyed by provider id (only for providers that have one). */
  loadDetails(providerIds: string[]): Promise<Map<string, unknown>>;
  toCardExtras(detail: unknown | undefined): CategoryCardExtras;
  toDetailExtras(detail: unknown | undefined): CategoryDetailExtras;
  /** Admin-side view of the stored detail (same shape as the input). */
  toAdminInput(detail: unknown | undefined): CategoryAdminInput;
  /** Persist admin input; no-op when the input has no block for this category. */
  saveDetails(manager: EntityManager, providerId: string, input: CategoryAdminInput): Promise<void>;
}
