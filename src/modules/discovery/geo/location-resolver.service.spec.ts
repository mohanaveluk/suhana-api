import { GeocodeResult, GeocodingProvider } from './geocoding.provider';
import { InvalidLocationException, LocationResolverService } from './location-resolver.service';

const hit = (over: Partial<GeocodeResult>): GeocodeResult => ({
  lat: 1, lng: 2, label: 'X', country: 'US', state: null, city: null, postalCode: null, ...over,
});

describe('LocationResolverService', () => {
  let geocoder: jest.Mocked<GeocodingProvider>;
  let svc: LocationResolverService;

  beforeEach(() => {
    geocoder = { lookupPostalCode: jest.fn(), lookupCity: jest.fn() };
    svc = new LocationResolverService(geocoder);
  });

  it('US ZIP → point (country inferred from 5 digits)', async () => {
    geocoder.lookupPostalCode.mockResolvedValue(hit({ lat: 40.52, lng: -74.39, label: 'Edison, NJ 08817' }));
    const o = await svc.resolve({ postalCode: '08817' });
    expect(geocoder.lookupPostalCode).toHaveBeenCalledWith('US', '08817');
    expect(o).toMatchObject({ kind: 'point', country: 'US', point: { lat: 40.52, lng: -74.39 }, source: 'postal' });
  });

  it('ZIP+4 is looked up by its first 5 digits', async () => {
    geocoder.lookupPostalCode.mockResolvedValue(hit({}));
    await svc.resolve({ postalCode: '08817-1234', country: 'us' });
    expect(geocoder.lookupPostalCode).toHaveBeenCalledWith('US', '08817');
  });

  it('India PIN → point (spaces tolerated)', async () => {
    geocoder.lookupPostalCode.mockResolvedValue(hit({ country: 'IN', lat: 13.08, lng: 80.27 }));
    const o = await svc.resolve({ postalCode: '600 001', country: 'IN' });
    expect(geocoder.lookupPostalCode).toHaveBeenCalledWith('IN', '600001');
    expect(o.kind).toBe('point');
  });

  it('rejects a malformed postal code with a friendly message', async () => {
    await expect(svc.resolve({ postalCode: '1234' })).rejects.toBeInstanceOf(InvalidLocationException);
    await expect(svc.resolve({ postalCode: '012345', country: 'IN' })).rejects.toThrow(/not a valid India PIN code/);
    await expect(svc.resolve({ postalCode: 'ABCDE', country: 'US' })).rejects.toThrow(/not a valid United States ZIP code/);
    expect(geocoder.lookupPostalCode).not.toHaveBeenCalled();
  });

  it('a well-formed but unknown code → POSTAL_CODE_NOT_FOUND', async () => {
    geocoder.lookupPostalCode.mockResolvedValue(null);
    await expect(svc.resolve({ postalCode: '999999', country: 'IN' })).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'POSTAL_CODE_NOT_FOUND' }),
    });
  });

  it('unsupported country → UNSUPPORTED_COUNTRY', async () => {
    await expect(svc.resolve({ country: 'GB' })).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'UNSUPPORTED_COUNTRY' }),
    });
  });

  it('city + state with coordinates → point', async () => {
    geocoder.lookupCity.mockResolvedValue(hit({ country: 'IN', label: 'Chennai, Tamil Nadu' }));
    const o = await svc.resolve({ city: ' Chennai ', state: 'Tamil Nadu', country: 'IN' });
    expect(geocoder.lookupCity).toHaveBeenCalledWith('IN', 'Chennai', 'Tamil Nadu');
    expect(o).toMatchObject({ kind: 'point', source: 'city' });
  });

  it('unknown city → text-area fallback (no distances)', async () => {
    geocoder.lookupCity.mockResolvedValue(null);
    const o = await svc.resolve({ city: 'Madurai', country: 'IN' });
    expect(o).toMatchObject({ kind: 'area', city: 'Madurai', country: 'IN' });
  });

  it('city without country → COUNTRY_REQUIRED', async () => {
    await expect(svc.resolve({ city: 'Chennai' })).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'COUNTRY_REQUIRED' }),
    });
  });

  it('country + state → area', async () => {
    expect(await svc.resolve({ country: 'IN', state: 'Tamil Nadu' })).toMatchObject({
      kind: 'area', country: 'IN', state: 'Tamil Nadu', city: null,
    });
  });

  it('country only → area; nothing → none', async () => {
    expect(await svc.resolve({ country: 'US' })).toMatchObject({ kind: 'area', country: 'US', state: null });
    expect(await svc.resolve({})).toMatchObject({ kind: 'none' });
  });

  it('device location is coarsened to ~1 km and never geocoded', async () => {
    const o = await svc.resolve({ lat: 12.971234, lng: 77.594567, country: 'IN' });
    expect(o).toMatchObject({ kind: 'point', point: { lat: 12.97, lng: 77.59 }, source: 'device' });
    expect(geocoder.lookupPostalCode).not.toHaveBeenCalled();
  });

  it('rejects out-of-range coordinates', async () => {
    await expect(svc.resolve({ lat: 123, lng: 0 })).rejects.toBeInstanceOf(InvalidLocationException);
  });

  it('default unit follows the country', () => {
    expect(svc.defaultUnit('US')).toBe('mi');
    expect(svc.defaultUnit('IN')).toBe('km');
    expect(svc.defaultUnit(null)).toBe('km');
  });
});
