import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DiscoveryAdminService } from './discovery-admin.service';
import { LocationResolverService } from '../geo/location-resolver.service';
import { ProviderVerificationStatus } from '../constants/discovery.enums';
import { AuditEventType } from '../../audit/enums/audit-event-type.enum';

describe('DiscoveryAdminService', () => {
  let providerRepo: any;
  let audit: { emit: jest.Mock };
  let geocoder: { lookupPostalCode: jest.Mock; lookupCity: jest.Mock };
  let svc: DiscoveryAdminService;
  let stored: any;

  beforeEach(() => {
    stored = {
      id: 'p1', displayName: 'Pandit X', verificationStatus: ProviderVerificationStatus.PENDING,
      verificationNotes: null, verifiedAt: null, verifiedBy: null,
    };
    providerRepo = {
      findOne: jest.fn(async () => stored),
      save: jest.fn(async (p) => p),
      softDelete: jest.fn(),
      restore: jest.fn(),
    };
    audit = { emit: jest.fn() };
    geocoder = { lookupPostalCode: jest.fn(), lookupCity: jest.fn() };
    svc = new DiscoveryAdminService(
      {} as any, providerRepo, {} as any, {} as any, {} as any, {} as any,
      new LocationResolverService(geocoder as any), geocoder as any, {} as any, audit as any,
    );
    // The full admin view is covered by integration checks; here we only need the workflow.
    jest.spyOn(svc, 'get').mockImplementation(async () => ({ ...stored }) as any);
  });

  describe('verification workflow', () => {
    it('PENDING → VERIFIED stamps who/when and is audited', async () => {
      const out = await svc.setVerification('p1', { status: ProviderVerificationStatus.VERIFIED }, 'admin1');
      expect(out.verificationStatus).toBe(ProviderVerificationStatus.VERIFIED);
      expect(stored.verifiedBy).toBe('admin1');
      expect(stored.verifiedAt).toBeInstanceOf(Date);
      expect(audit.emit).toHaveBeenCalledWith(expect.objectContaining({
        eventType: AuditEventType.DISCOVERY_PROVIDER_VERIFICATION_CHANGED,
        userId: 'admin1',
        oldValue: { status: 'PENDING', notes: null },
        newValue: expect.objectContaining({ status: 'VERIFIED' }),
      }));
    });

    it.each([ProviderVerificationStatus.REJECTED, ProviderVerificationStatus.SUSPENDED])(
      '%s requires a note',
      async (status) => {
        await expect(svc.setVerification('p1', { status }, 'admin1')).rejects.toBeInstanceOf(BadRequestException);
        await expect(svc.setVerification('p1', { status, notes: '   ' }, 'admin1')).rejects.toBeInstanceOf(BadRequestException);
        expect(providerRepo.save).not.toHaveBeenCalled();
        expect(audit.emit).not.toHaveBeenCalled();
      },
    );

    it('VERIFIED → SUSPENDED clears the verified stamp (badge disappears)', async () => {
      stored.verificationStatus = ProviderVerificationStatus.VERIFIED;
      stored.verifiedAt = new Date();
      stored.verifiedBy = 'admin0';
      await svc.setVerification('p1', { status: ProviderVerificationStatus.SUSPENDED, notes: 'Complaint under review' }, 'admin1');
      expect(stored).toMatchObject({ verificationStatus: 'SUSPENDED', verifiedAt: null, verifiedBy: null, verificationNotes: 'Complaint under review' });
    });

    it('unknown listing → 404', async () => {
      providerRepo.findOne.mockResolvedValue(null);
      await expect(svc.setVerification('nope', { status: ProviderVerificationStatus.VERIFIED }, 'a')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  it('soft delete is audited', async () => {
    await svc.remove('p1', 'admin1');
    expect(providerRepo.softDelete).toHaveBeenCalledWith({ id: 'p1' });
    expect(audit.emit).toHaveBeenCalledWith(expect.objectContaining({ eventType: AuditEventType.DISCOVERY_PROVIDER_DELETED }));
  });

  describe('location coordinates', () => {
    it('explicit lat/lng win', async () => {
      const c = await svc.resolveCoordinates({ city: 'Chennai', country: 'IN', latitude: 13, longitude: 80, postalCode: '600001' });
      expect(c).toEqual({ lat: 13, lng: 80, source: 'manual', postalCode: '600001' });
      expect(geocoder.lookupPostalCode).not.toHaveBeenCalled();
    });

    it('postal code → centroid', async () => {
      geocoder.lookupPostalCode.mockResolvedValue({ lat: 40.5, lng: -74.4 });
      expect(await svc.resolveCoordinates({ city: 'Edison', country: 'US', postalCode: '08817-0001' }))
        .toMatchObject({ lat: 40.5, lng: -74.4, source: 'postal', postalCode: '08817' });
    });

    it('falls back to the city, then to none (flagged in the admin list)', async () => {
      geocoder.lookupPostalCode.mockResolvedValue(null);
      geocoder.lookupCity.mockResolvedValueOnce({ lat: 1, lng: 2 }).mockResolvedValueOnce(null);
      expect((await svc.resolveCoordinates({ city: 'A', country: 'IN', postalCode: '600001' })).source).toBe('city');
      expect(await svc.resolveCoordinates({ city: 'B', country: 'IN' })).toMatchObject({ lat: null, lng: null, source: 'none' });
    });

    it('malformed postal code → 400', async () => {
      await expect(svc.resolveCoordinates({ city: 'A', country: 'IN', postalCode: '12' })).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});
