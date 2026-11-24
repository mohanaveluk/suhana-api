import { NotFoundException } from '@nestjs/common';
import { DiscoveryFavoritesService } from './discovery-favorites.service';

describe('DiscoveryFavoritesService', () => {
  let repo: { findOne: jest.Mock; save: jest.Mock; create: jest.Mock; delete: jest.Mock; findAndCount: jest.Mock };
  let search: { findVisibleProvider: jest.Mock };
  let presenter: { toCards: jest.Mock };
  let svc: DiscoveryFavoritesService;

  beforeEach(() => {
    repo = {
      findOne: jest.fn().mockResolvedValue(null),
      save: jest.fn(async (x) => x),
      create: jest.fn((x) => x),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
      findAndCount: jest.fn(),
    };
    search = { findVisibleProvider: jest.fn().mockResolvedValue({ id: 'p1' }) };
    presenter = { toCards: jest.fn(async (ids: string[]) => ids.map((id) => ({ id, isFavorite: true }))) };
    svc = new DiscoveryFavoritesService(repo as any, search as any, presenter as any);
  });

  it('add: saves a row for the caller', async () => {
    await expect(svc.add('u1', 'p1')).resolves.toEqual({ providerId: 'p1', isFavorite: true });
    expect(repo.save).toHaveBeenCalledWith({ userId: 'u1', providerId: 'p1' });
  });

  it('add is idempotent (existing row → no second insert)', async () => {
    repo.findOne.mockResolvedValue({ id: 'f1', userId: 'u1', providerId: 'p1' });
    await svc.add('u1', 'p1');
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('add tolerates a concurrent duplicate insert', async () => {
    repo.save.mockRejectedValue({ code: 'ER_DUP_ENTRY' });
    await expect(svc.add('u1', 'p1')).resolves.toMatchObject({ isFavorite: true });
  });

  it('add: hidden / unknown listing → 404, nothing saved', async () => {
    search.findVisibleProvider.mockRejectedValue(new NotFoundException());
    await expect(svc.add('u1', 'p9')).rejects.toBeInstanceOf(NotFoundException);
    expect(repo.save).not.toHaveBeenCalled();
  });

  it("remove only ever deletes the caller's own row (IDOR-safe)", async () => {
    await expect(svc.remove('u1', 'p1')).resolves.toEqual({ providerId: 'p1', isFavorite: false });
    expect(repo.delete).toHaveBeenCalledWith({ userId: 'u1', providerId: 'p1' });
  });

  it('list is scoped to the caller and paginated', async () => {
    repo.findAndCount.mockResolvedValue([[{ providerId: 'p2' }, { providerId: 'p1' }], 7]);
    const res = await svc.list('u1', 2, 2);
    expect(repo.findAndCount).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: 'u1' }, skip: 2, take: 2 }));
    expect(res).toMatchObject({ total: 7, page: 2, limit: 2, totalPages: 4 });
    expect(res.items.map((i) => i.id)).toEqual(['p2', 'p1']);
  });
});
