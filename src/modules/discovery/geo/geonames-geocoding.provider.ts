import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GeoPostalCode } from '../entities/geo-postal-code.entity';
import { GeocodeResult, GeocodingProvider } from './geocoding.provider';

interface CentroidRow {
  lat: string | number | null;
  lng: string | number | null;
  place: string | null;
  state: string | null;
  n: string | number;
}

/**
 * Geocoder backed by the geo_postal_codes table (GeoNames import).
 * Each lookup is a single indexed aggregate query.
 */
@Injectable()
export class GeoNamesGeocodingProvider implements GeocodingProvider {
  constructor(@InjectRepository(GeoPostalCode) private readonly geoRepo: Repository<GeoPostalCode>) {}

  async lookupPostalCode(country: string, postalCode: string): Promise<GeocodeResult | null> {
    const row: CentroidRow | undefined = await this.geoRepo
      .createQueryBuilder('g')
      .select('AVG(g.latitude)', 'lat')
      .addSelect('AVG(g.longitude)', 'lng')
      .addSelect('MIN(g.place_name)', 'place')
      .addSelect('MIN(g.admin_name1)', 'state')
      .addSelect('COUNT(*)', 'n')
      .where('g.country_code = :country AND g.postal_code = :postalCode', { country, postalCode })
      .getRawOne();
    if (!row || Number(row.n) === 0 || row.lat === null) return null;
    const city = row.place ?? null;
    return {
      lat: Number(row.lat),
      lng: Number(row.lng),
      country,
      state: row.state ?? null,
      city,
      postalCode,
      label: [city, [row.state, postalCode].filter(Boolean).join(' ')].filter(Boolean).join(', '),
    };
  }

  async lookupCity(country: string, city: string, state?: string | null): Promise<GeocodeResult | null> {
    const qb = this.geoRepo
      .createQueryBuilder('g')
      .select('AVG(g.latitude)', 'lat')
      .addSelect('AVG(g.longitude)', 'lng')
      .addSelect('MIN(g.place_name)', 'place')
      .addSelect('MIN(g.admin_name1)', 'state')
      .addSelect('COUNT(*)', 'n')
      .where('g.country_code = :country AND g.place_name = :city', { country, city });
    if (state) {
      // Accept either the state name ("Tamil Nadu") or code ("TX").
      qb.andWhere('(g.admin_name1 = :state OR g.admin_code1 = :state)', { state });
    }
    const row: CentroidRow | undefined = await qb.getRawOne();
    if (!row || Number(row.n) === 0 || row.lat === null) return null;
    return {
      lat: Number(row.lat),
      lng: Number(row.lng),
      country,
      state: row.state ?? state ?? null,
      city: row.place ?? city,
      postalCode: null,
      label: [row.place ?? city, row.state ?? state].filter(Boolean).join(', '),
    };
  }
}
