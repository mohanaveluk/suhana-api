import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../audit/audit.module';
import { CloudStorageService } from '../../common/services/cloud-storage.service';
import { DISCOVERY_ENTITIES } from './entities';
import { DiscoveryController } from './controllers/discovery.controller';
import { AdminDiscoveryController } from './controllers/admin-discovery.controller';
import { DiscoveryCatalogService } from './services/discovery-catalog.service';
import { DiscoverySearchService } from './services/discovery-search.service';
import { DiscoveryFavoritesService } from './services/discovery-favorites.service';
import { DiscoveryReviewsService } from './services/discovery-reviews.service';
import { DiscoveryAdminService } from './services/discovery-admin.service';
import { ProviderPresenterService } from './services/provider-presenter.service';
import { LocationResolverService } from './geo/location-resolver.service';
import { GEOCODING_PROVIDER } from './geo/geocoding.provider';
import { GeoNamesGeocodingProvider } from './geo/geonames-geocoding.provider';
import { CategoryHandlerRegistry } from './categories/category-handler.registry';
import { AstrologerCategoryHandler } from './categories/astrologer-category.handler';
import { GenericCategoryHandler } from './categories/generic-category.handler';
import { MemberThrottlerGuard } from './controllers/member-throttler.guard';
import { ProviderPortalController } from './controllers/provider-portal.controller';
import { DiscoveryOwnershipService } from './services/discovery-ownership.service';
import { ProviderPortalService } from './services/provider-portal.service';
import { User } from '../user/entity/user.entity';
import { RoleEntity } from '../user/entity/roles.entity';
import { EmailModule } from '../../shared/email/email.module';

/**
 * Aurora Discover — category-driven local services directory.
 * Phase 1: astrologers. See docs/aurora-discover.md.
 *
 * Geocoding is bound through GEOCODING_PROVIDER (default: local GeoNames
 * postal-code table, no network/API key). Swap the binding for a hosted
 * geocoder later without touching search.
 */
@Module({
  imports: [TypeOrmModule.forFeature([...DISCOVERY_ENTITIES, User, RoleEntity]), AuditModule, EmailModule],
  controllers: [DiscoveryController, AdminDiscoveryController, ProviderPortalController],
  providers: [
    DiscoveryCatalogService,
    DiscoverySearchService,
    DiscoveryFavoritesService,
    DiscoveryReviewsService,
    DiscoveryAdminService,
    ProviderPresenterService,
    LocationResolverService,
    { provide: GEOCODING_PROVIDER, useClass: GeoNamesGeocodingProvider },
    CategoryHandlerRegistry,
    AstrologerCategoryHandler,
    GenericCategoryHandler,
    CloudStorageService,
    MemberThrottlerGuard,
    DiscoveryOwnershipService,
    ProviderPortalService,
  ],
  exports: [DiscoverySearchService],
})
export class DiscoveryModule {}
