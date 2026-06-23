import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { EmailHistoryService, SaveEmailHistoryInput } from './email-history.service';
import { EmailHistoryRepository } from './email-history.repository';
import { EmailHistory, EmailStatus } from './entity/email-history.entity';

const mockRepo = () => ({
  create:              jest.fn(),
  save:                jest.fn(),
  findById:            jest.fn(),
  findByGuid:          jest.fn(),
  findSentByUser:      jest.fn(),
  findReceivedByUser:  jest.fn(),
  findNotifications:   jest.fn(),
  findConversation:    jest.fn(),
  markAsRead:          jest.fn(),
  markAsOpened:        jest.fn(),
});

const baseInput: SaveEmailHistoryInput = {
  emailType:  'INTEREST_SENT',
  from:       'noreply@suhana.com',
  to:         'user@example.com',
  subject:    'Interest Sent',
  html:       '<p>Hello</p>',
  status:     'SENT',
};

describe('EmailHistoryService', () => {
  let service: EmailHistoryService;
  let repo: ReturnType<typeof mockRepo>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailHistoryService,
        { provide: EmailHistoryRepository, useFactory: mockRepo },
      ],
    }).compile();

    service = module.get(EmailHistoryService);
    repo    = module.get(EmailHistoryRepository);
  });

  it('should be defined', () => expect(service).toBeDefined());

  describe('saveEmailHistory', () => {
    it('creates and saves a record with SENT status and sentAt populated', async () => {
      const entity = { id: 1 } as EmailHistory;
      repo.create.mockReturnValue(entity);
      repo.save.mockResolvedValue(entity);

      const result = await service.saveEmailHistory(baseInput);

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          emailType: 'INTEREST_SENT',
          fromEmail: 'noreply@suhana.com',
          toEmail:   'user@example.com',
          status:    EmailStatus.SENT,
          sentAt:    expect.any(Date),
        }),
      );
      expect(repo.save).toHaveBeenCalledWith(entity);
      expect(result).toBe(entity);
    });

    it('sets sentAt to null when status is FAILED', async () => {
      const entity = { id: 2 } as EmailHistory;
      repo.create.mockReturnValue(entity);
      repo.save.mockResolvedValue(entity);

      await service.saveEmailHistory({ ...baseInput, status: 'FAILED' });

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ sentAt: null, status: EmailStatus.FAILED }),
      );
    });

    it('joins array recipients into comma-separated string', async () => {
      const entity = {} as EmailHistory;
      repo.create.mockReturnValue(entity);
      repo.save.mockResolvedValue(entity);

      await service.saveEmailHistory({ ...baseInput, to: ['a@x.com', 'b@x.com'] });

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({ toEmail: 'a@x.com,b@x.com' }),
      );
    });
  });

  describe('findById', () => {
    it('returns record when found', async () => {
      const entity = { id: 1 } as EmailHistory;
      repo.findById.mockResolvedValue(entity);
      expect(await service.findById(1)).toBe(entity);
    });

    it('throws NotFoundException when not found', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(service.findById(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('markAsRead', () => {
    it('calls repo.markAsRead and returns message', async () => {
      repo.findById.mockResolvedValue({ id: 1 } as EmailHistory);
      repo.markAsRead.mockResolvedValue(undefined);

      const result = await service.markAsRead(1);
      expect(repo.markAsRead).toHaveBeenCalledWith(1);
      expect(result).toEqual({ message: 'Marked as read' });
    });

    it('throws NotFoundException if record does not exist', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(service.markAsRead(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('getConversation', () => {
    it('delegates to repo.findConversation', async () => {
      const records = [{ id: 1 }, { id: 2 }] as EmailHistory[];
      repo.findConversation.mockResolvedValue(records);

      const result = await service.getConversation('u1', 'u2');
      expect(repo.findConversation).toHaveBeenCalledWith('u1', 'u2');
      expect(result).toBe(records);
    });
  });
});
