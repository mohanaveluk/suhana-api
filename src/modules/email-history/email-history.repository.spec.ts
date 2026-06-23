import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmailHistoryRepository } from './email-history.repository';
import { EmailHistory, EmailStatus } from './entity/email-history.entity';

const mockTypeOrmRepo = () => ({
  create:   jest.fn(),
  save:     jest.fn(),
  findOne:  jest.fn(),
  find:     jest.fn(),
  update:   jest.fn(),
  createQueryBuilder: jest.fn(() => ({
    where:    jest.fn().mockReturnThis(),
    orderBy:  jest.fn().mockReturnThis(),
    select:   jest.fn().mockReturnThis(),
    getMany:  jest.fn(),
  })),
});

describe('EmailHistoryRepository', () => {
  let repo: EmailHistoryRepository;
  let ormRepo: jest.Mocked<Repository<EmailHistory>>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailHistoryRepository,
        { provide: getRepositoryToken(EmailHistory), useFactory: mockTypeOrmRepo },
      ],
    }).compile();

    repo    = module.get(EmailHistoryRepository);
    ormRepo = module.get(getRepositoryToken(EmailHistory));
  });

  it('should be defined', () => expect(repo).toBeDefined());

  describe('findById', () => {
    it('returns record when found', async () => {
      const record = { id: 1 } as EmailHistory;
      ormRepo.findOne.mockResolvedValue(record);
      expect(await repo.findById(1)).toBe(record);
      expect(ormRepo.findOne).toHaveBeenCalledWith({ where: { id: 1 } });
    });

    it('returns null when not found', async () => {
      ormRepo.findOne.mockResolvedValue(null);
      expect(await repo.findById(999)).toBeNull();
    });
  });

  describe('findSentByUser', () => {
    it('returns emails where fromUserId matches', async () => {
      const records = [{ id: 1, fromUserId: 'user-1' }] as EmailHistory[];
      ormRepo.find.mockResolvedValue(records);
      const result = await repo.findSentByUser('user-1');
      expect(result).toBe(records);
      expect(ormRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: { fromUserId: 'user-1' } }),
      );
    });
  });

  describe('markAsRead', () => {
    it('calls update with readAt timestamp', async () => {
      ormRepo.update.mockResolvedValue(undefined as any);
      await repo.markAsRead(5);
      expect(ormRepo.update).toHaveBeenCalledWith(5, expect.objectContaining({ readAt: expect.any(Date) }));
    });
  });

  describe('markAsOpened', () => {
    it('calls update with openedAt timestamp', async () => {
      ormRepo.update.mockResolvedValue(undefined as any);
      await repo.markAsOpened(5);
      expect(ormRepo.update).toHaveBeenCalledWith(5, expect.objectContaining({ openedAt: expect.any(Date) }));
    });
  });
});
