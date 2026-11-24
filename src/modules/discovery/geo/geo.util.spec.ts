import { boundingBox, coarsen, fromKm, haversineKm, isValidLatLng, toKm } from './geo.util';

describe('geo.util', () => {
  const chennai = { lat: 13.0878, lng: 80.2785 };
  const bengaluru = { lat: 12.9762, lng: 77.6033 };

  it('haversine: Chennai → Bengaluru ≈ 290 km', () => {
    const d = haversineKm(chennai, bengaluru);
    expect(d).toBeGreaterThan(280);
    expect(d).toBeLessThan(300);
    expect(haversineKm(chennai, chennai)).toBeCloseTo(0, 6);
  });

  it('converts miles ↔ km', () => {
    expect(toKm(10, 'mi')).toBeCloseTo(16.09344, 4);
    expect(toKm(10, 'km')).toBe(10);
    expect(fromKm(16.09344, 'mi')).toBeCloseTo(10, 4);
  });

  it('bounding box contains every point within the radius', () => {
    const box = boundingBox(chennai, 50);
    // Points 50 km due N/S/E/W must fall inside the box.
    const dLat = 50 / 111.2;
    const dLng = 50 / (111.2 * Math.cos((chennai.lat * Math.PI) / 180));
    expect(chennai.lat + dLat).toBeLessThanOrEqual(box.maxLat + 1e-6);
    expect(chennai.lat - dLat).toBeGreaterThanOrEqual(box.minLat - 1e-6);
    expect(chennai.lng + dLng).toBeLessThanOrEqual(box.maxLng! + 1e-3);
    expect(chennai.lng - dLng).toBeGreaterThanOrEqual(box.minLng! - 1e-3);
  });

  it('drops the longitude filter across the antimeridian or near a pole', () => {
    expect(boundingBox({ lat: 10, lng: 179.9 }, 50).minLng).toBeNull();
    expect(boundingBox({ lat: 89.9, lng: 0 }, 100).minLng).toBeNull();
  });

  it('coarsens member coordinates to 2 dp (~1 km)', () => {
    expect(coarsen(12.971234)).toBe(12.97);
    expect(coarsen(-73.99712)).toBe(-74);
  });

  it('validates coordinates', () => {
    expect(isValidLatLng(12, 77)).toBe(true);
    expect(isValidLatLng(91, 0)).toBe(false);
    expect(isValidLatLng(0, 181)).toBe(false);
    expect(isValidLatLng(NaN, 0)).toBe(false);
  });
});
