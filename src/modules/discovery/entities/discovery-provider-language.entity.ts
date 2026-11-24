import { Entity, Index, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { DiscoveryProvider } from './discovery-provider.entity';

@Entity('discovery_provider_languages')
@Index('IDX_DISCOVERY_PROVIDER_LANGUAGES_CODE', ['languageCode'])
export class DiscoveryProviderLanguage {
  @PrimaryColumn({ type: 'varchar', length: 36, name: 'provider_id' })
  providerId: string;

  /** ISO 639 code (en, hi, ta, …). */
  @PrimaryColumn({ type: 'varchar', length: 8, name: 'language_code' })
  languageCode: string;

  @ManyToOne(() => DiscoveryProvider, (p) => p.languages, { createForeignKeyConstraints: false })
  @JoinColumn({ name: 'provider_id' })
  provider: DiscoveryProvider;
}
