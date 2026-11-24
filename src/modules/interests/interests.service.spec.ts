import { BadRequestException, ForbiddenException, HttpException, HttpStatus } from '@nestjs/common';
import { InterestsService, MAX_INTERESTS_PER_DAY } from './interests.service';
import { AuditEventType } from '../audit/enums/audit-event-type.enum';

/** Chainable QueryBuilder stub: every builder method returns itself; terminal methods are jest.fn(). */
function qb(result: { count?: number } = {}) {
  const b: any = {};
  for (const m of ['where', 'andWhere', 'orWhere', 'update', 'set']) b[m] = jest.fn(() => b);
  b.getCount = jest.fn().mockResolvedValue(result.count ?? 0);
  b.execute = jest.fn().mockResolvedValue({ affected: 1 });
  return b;
}

function setup(opts: { blockCount?: number; sentToday?: number; emailInterests?: boolean } = {}) {
  const interestRepo: any = {
    findOne: jest.fn(),
    save: jest.fn(async (x: any) => ({ ...x, id: x.id ?? 'new-id' })),
    create: jest.fn((x: any) => ({ ...x })),
    createQueryBuilder: jest.fn(() => qb({ count: opts.sentToday ?? 0 })),
  };
  const matchQb = qb();
  const matchRepo: any = {
    findOne: jest.fn().mockResolvedValue(null),
    save: jest.fn(async (x: any) => x),
    create: jest.fn((x: any) => x),
    createQueryBuilder: jest.fn(() => matchQb),
  };
  const userRepo: any = {
    findOne: jest.fn(async ({ where }: any) => ({
      id: where.id, email: `${where.id}@example.test`, first_name: where.id, last_name: 'X',
      profile: { firstName: where.id, profileCode: 'CODE', photos: [] },
    })),
  };
  const blockRepo: any = { createQueryBuilder: jest.fn(() => qb({ count: opts.blockCount ?? 0 })) };
  const settingsRepo: any = {
    findOne: jest.fn().mockResolvedValue(opts.emailInterests === undefined ? null : { emailInterests: opts.emailInterests }),
  };
  const emailService: any = { sendEmail: jest.fn().mockResolvedValue(undefined) };
  const logger: any = { debug: jest.fn() };
  const chatService: any = { startConversationByProfiles: jest.fn().mockResolvedValue(undefined) };
  const auditEmitter: any = { emit: jest.fn() };

  const service = new InterestsService(
    interestRepo, userRepo, matchRepo, blockRepo, settingsRepo, emailService, logger, chatService, auditEmitter,
  );
  return { service, interestRepo, matchRepo, matchQb, emailService, chatService, auditEmitter };
}

const pending = (over: Record<string, unknown> = {}) => ({
  id: 'i1', fromUserId: 'groom', toUserId: 'bride', status: 'pending', isRead: false, readAt: null, ...over,
});

describe('InterestsService — My Interests lifecycle', () => {
  describe('send', () => {
    it('rejects interest to yourself', async () => {
      const { service } = setup();
      await expect(service.send('a', 'a')).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a duplicate while an interest is open or answered', async () => {
      const { service, interestRepo } = setup();
      interestRepo.findOne.mockResolvedValue(pending());
      await expect(service.send('groom', 'bride')).rejects.toThrow('Interest already sent');
    });

    it('refuses when either member blocked the other', async () => {
      const { service, interestRepo } = setup({ blockCount: 1 });
      interestRepo.findOne.mockResolvedValue(null);
      await expect(service.send('groom', 'bride')).rejects.toBeInstanceOf(ForbiddenException);
    });

    it(`enforces the ${MAX_INTERESTS_PER_DAY}-per-day cap with HTTP 429`, async () => {
      const { service, interestRepo } = setup({ sentToday: MAX_INTERESTS_PER_DAY });
      interestRepo.findOne.mockResolvedValue(null);
      const err = await service.send('groom', 'bride').catch(e => e);
      expect(err).toBeInstanceOf(HttpException);
      expect((err as HttpException).getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
    });

    it('records the source and audits the new interest', async () => {
      const { service, interestRepo, auditEmitter } = setup();
      interestRepo.findOne.mockResolvedValue(null);
      const saved = await service.send('groom', 'bride', 'Hello', 'https://site', 'AI_MATCH');
      expect(saved.source).toBe('AI_MATCH');
      expect(auditEmitter.emit).toHaveBeenCalledWith(expect.objectContaining({ eventType: AuditEventType.INTEREST_SENT }));
    });

    it('re-opens a withdrawn interest instead of creating a duplicate row', async () => {
      const { service, interestRepo } = setup();
      interestRepo.findOne.mockResolvedValue(pending({ status: 'withdrawn', isRead: true, withdrawnAt: new Date() }));
      const saved = await service.send('groom', 'bride', 'Again');
      expect(interestRepo.create).not.toHaveBeenCalled();
      expect(saved).toEqual(expect.objectContaining({ id: 'i1', status: 'pending', isRead: false, withdrawnAt: null }));
    });

    it('skips the email when the recipient opted out of interest emails', async () => {
      const { service, interestRepo, emailService } = setup({ emailInterests: false });
      interestRepo.findOne.mockResolvedValue(null);
      await service.send('groom', 'bride');
      expect(emailService.sendEmail).not.toHaveBeenCalled();
    });
  });

  describe('accept / decline (recipient only)', () => {
    it('only the recipient can accept', async () => {
      const { service, interestRepo } = setup();
      interestRepo.findOne.mockResolvedValue(pending());
      await expect(service.accept('i1', 'groom')).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('accepting marks it read/responded, opens a chat and audits', async () => {
      const { service, interestRepo, chatService, auditEmitter } = setup();
      interestRepo.findOne.mockResolvedValue(pending({
        fromUser: { id: 'groom', email: 'g@example.test', first_name: 'G', profile: { firstName: 'G' } },
      }));
      const saved = await service.accept('i1', 'bride');
      expect(saved).toEqual(expect.objectContaining({ status: 'accepted', isRead: true }));
      expect(saved.acceptedOn).toBeInstanceOf(Date);
      expect(saved.respondedAt).toBeInstanceOf(Date);
      expect(chatService.startConversationByProfiles).toHaveBeenCalled();
      expect(auditEmitter.emit).toHaveBeenCalledWith(expect.objectContaining({ eventType: AuditEventType.INTEREST_ACCEPTED }));
    });

    it('cannot accept across a block', async () => {
      const { service, interestRepo } = setup({ blockCount: 1 });
      interestRepo.findOne.mockResolvedValue(pending());
      await expect(service.accept('i1', 'bride')).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('declining keeps the row with status declined', async () => {
      const { service, interestRepo } = setup();
      interestRepo.findOne.mockResolvedValue(pending());
      const saved = await service.decline('i1', 'bride');
      expect(saved).toEqual(expect.objectContaining({ status: 'declined', isRead: true }));
      expect(saved.respondedAt).toBeInstanceOf(Date);
    });

    it('cannot answer an interest twice', async () => {
      const { service, interestRepo } = setup();
      interestRepo.findOne.mockResolvedValue(pending({ status: 'accepted' }));
      await expect(service.decline('i1', 'bride')).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('withdraw (sender only)', () => {
    it('only the sender can withdraw', async () => {
      const { service, interestRepo } = setup();
      interestRepo.findOne.mockResolvedValue(pending());
      await expect(service.withdraw('i1', 'bride')).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('only pending interests can be withdrawn', async () => {
      const { service, interestRepo } = setup();
      interestRepo.findOne.mockResolvedValue(pending({ status: 'accepted' }));
      await expect(service.withdraw('i1', 'groom')).rejects.toBeInstanceOf(BadRequestException);
    });

    it('withdrawing keeps history, resets the match funnel and audits', async () => {
      const { service, interestRepo, matchQb, auditEmitter } = setup();
      interestRepo.findOne.mockResolvedValue(pending());
      const saved = await service.withdraw('i1', 'groom');
      expect(saved.status).toBe('withdrawn');
      expect(saved.withdrawnAt).toBeInstanceOf(Date);
      expect(matchQb.set).toHaveBeenCalledWith({ status: 'suggested', currentStep: 0 });
      expect(auditEmitter.emit).toHaveBeenCalledWith(expect.objectContaining({ eventType: AuditEventType.INTEREST_WITHDRAWN }));
    });
  });

  describe('markRead (recipient only)', () => {
    it('only the recipient can mark it read', async () => {
      const { service, interestRepo } = setup();
      interestRepo.findOne.mockResolvedValue(pending());
      await expect(service.markRead('i1', 'groom')).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('is idempotent', async () => {
      const { service, interestRepo } = setup();
      interestRepo.findOne.mockResolvedValue(pending({ isRead: true }));
      await service.markRead('i1', 'bride');
      expect(interestRepo.save).not.toHaveBeenCalled();
    });

    it('marks a new interest as viewed', async () => {
      const { service, interestRepo } = setup();
      interestRepo.findOne.mockResolvedValue(pending());
      const saved = await service.markRead('i1', 'bride');
      expect(saved).toEqual(expect.objectContaining({ isRead: true }));
      expect(saved.readAt).toBeInstanceOf(Date);
    });
  });
});
