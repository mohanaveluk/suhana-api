import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CategoryHandler } from './category-handler';
import { AstrologerCategoryHandler } from './astrologer-category.handler';
import { GenericCategoryHandler } from './generic-category.handler';
import { ConfigurableCategoryHandler } from './configurable-category.handler';
import { CATEGORY_DEFINITIONS } from './category-definitions';
import { DiscoveryServiceDetail } from '../entities/discovery-service-detail.entity';
import { DiscoveryCategory } from '../entities/discovery-category.entity';

/**
 * Resolves the handler for a category slug: astrologers have a dedicated
 * handler; every category in CATEGORY_DEFINITIONS gets a configurable one;
 * anything else falls back to the generic handler.
 */
@Injectable()
export class CategoryHandlerRegistry {
  private readonly handlers: Map<string, CategoryHandler>;

  constructor(
    astrologer: AstrologerCategoryHandler,
    private readonly generic: GenericCategoryHandler,
    @InjectRepository(DiscoveryServiceDetail) detailRepo?: Repository<DiscoveryServiceDetail>,
    @InjectRepository(DiscoveryCategory) categoryRepo?: Repository<DiscoveryCategory>,
  ) {
    this.handlers = new Map<string, CategoryHandler>([[astrologer.slug, astrologer]]);
    if (detailRepo && categoryRepo) {
      for (const def of CATEGORY_DEFINITIONS) {
        this.handlers.set(def.slug, new ConfigurableCategoryHandler(def, detailRepo, categoryRepo));
      }
    }
  }

  for(slug: string): CategoryHandler {
    return this.handlers.get(slug) ?? this.generic;
  }

  all(): CategoryHandler[] {
    return [...this.handlers.values()];
  }
}
