import { DiscoveryCategory } from './discovery-category.entity';
import { DiscoveryProvider } from './discovery-provider.entity';
import { DiscoveryProviderCategory } from './discovery-provider-category.entity';
import { DiscoveryLocation } from './discovery-location.entity';
import { DiscoveryService } from './discovery-service.entity';
import { DiscoveryProviderLanguage } from './discovery-provider-language.entity';
import { DiscoveryProviderMedia } from './discovery-provider-media.entity';
import { DiscoveryAstrologerDetail } from './discovery-astrologer-detail.entity';
import { DiscoveryFavorite } from './discovery-favorite.entity';
import { DiscoveryReview } from './discovery-review.entity';
import { GeoPostalCode } from './geo-postal-code.entity';
import { DiscoveryServiceDetail } from './discovery-service-detail.entity';

export {
  DiscoveryCategory, DiscoveryProvider, DiscoveryProviderCategory, DiscoveryLocation, DiscoveryService,
  DiscoveryProviderLanguage, DiscoveryProviderMedia, DiscoveryAstrologerDetail, DiscoveryFavorite,
  DiscoveryReview, GeoPostalCode, DiscoveryServiceDetail,
};
export type { BusinessHoursEntry, CertificationEntry } from './discovery-astrologer-detail.entity';

export const DISCOVERY_ENTITIES = [
  DiscoveryCategory, DiscoveryProvider, DiscoveryProviderCategory, DiscoveryLocation, DiscoveryService,
  DiscoveryProviderLanguage, DiscoveryProviderMedia, DiscoveryAstrologerDetail, DiscoveryFavorite,
  DiscoveryReview, GeoPostalCode, DiscoveryServiceDetail,
];
