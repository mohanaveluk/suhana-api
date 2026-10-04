import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';

import { PersonalityService } from './personality.service';
import { PersonalityQuestion } from './entities/personality-question.entity';
import { PersonalityAssessment } from './entities/personality-assessment.entity';
import { PersonalityResponse } from './entities/personality-response.entity';
import { Profile } from '../user/entity';
import { AuditEmitter } from '../audit/audit.emitter';
import { AuditEventType } from '../audit/enums/audit-event-type.enum';
import { CustomLoggerService } from '../logger/custom-logger.service';
import { PERSONALITY_COMPATIBILITY_PROVIDER } from './compatibility/personality-compatibility-provider.interface';
import { RuleBasedCompatibilityProvider } from './compatibility/rule-based-compatibility.provider';
import {
  PERSONALITY_QUESTION_BANK,
  buildOptionSeeds,
} from './seed/personality-question-bank';
import {
  AssessmentStatus,
  ConfidenceLevel,
  LikertOptionKey,
  PERSONALITY_UNAVAILABLE_MESSAGE,
} from './enums/personality.enums';

// Seeded bank as entities. Option ids are questionId * 10 + displayOrder.
const buildQuestions = (): PersonalityQuestion[] =>
  [...PERSONALITY_QUESTION_BANK]
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .map((q) => ({
      id: q.id,
      questionCode: q.code,
      questionText: q.text,
      dimension: q.dimension,
      translations:
        q.id === 1
          ? { ta: 'நான் கவனத்தின் மையமாக இருப்பதை விரும்புகிறேன்.' }
          : null,
      activeFlag: true,
      displayOrder: q.displayOrder,
      options: buildOptionSeeds(q).map((o) => ({
        id: q.id * 10 + o.displayOrder,
        questionId: q.id,
        optionKey: o.optionKey,
        optionText: o.optionText,
        scoreDirection: o.scoreDirection,
        scoreValue: o.scoreValue,
        displayOrder: o.displayOrder,
        translations: null,
      })),
    })) as unknown as PersonalityQuestion[];

const optionIdFor = (questionId: number, key: LikertOptionKey) =>
  questionId * 10 +
  [
    LikertOptionKey.STRONGLY_AGREE,
    LikertOptionKey.AGREE,
    LikertOptionKey.NEUTRAL,
    LikertOptionKey.DISAGREE,
    LikertOptionKey.STRONGLY_DISAGREE,
  ].indexOf(key) +
  1;

const answerAll = (key: LikertOptionKey) =>
  PERSONALITY_QUESTION_BANK.map((q) => ({
    questionId: q.id,
    optionId: optionIdFor(q.id, key),
  }));

const completedAssessment = (
  profileId: string,
  overrides: Partial<PersonalityAssessment> = {},
): PersonalityAssessment =>
  ({
    id: `assess-${profileId}`,
    profileId,
    status: AssessmentStatus.COMPLETED,
    completedDate: new Date('2026-10-01T10:00:00Z'),
    personalityType: 'INFJ',
    confidenceScore: 75,
    extroversionScore: 2,
    introversionScore: 14,
    sensingScore: 3,
    intuitionScore: 13,
    thinkingScore: 4,
    feelingScore: 12,
    judgingScore: 12,
    perceivingScore: 4,
    ...overrides,
  }) as PersonalityAssessment;

describe('PersonalityService', () => {
  let service: PersonalityService;
  let questionRepo: any;
  let assessmentRepo: any;
  let profileRepo: any;
  let txAssessmentRepo: any;
  let txResponseRepo: any;
  let auditEmitter: any;

  const MEMBER = { id: 'user-1', role: 'user' };
  const ADMIN = { id: 'admin-1', role: 'admin' };

  const mockOwnProfile = (profile: { id: string } | null) => {
    profileRepo.createQueryBuilder.mockReturnValue({
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(profile),
    });
  };

  beforeEach(async () => {
    questionRepo = { find: jest.fn().mockResolvedValue(buildQuestions()) };
    assessmentRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((data) => ({ ...data })),
      save: jest.fn(async (entity) => ({
        id: 'new-assessment',
        createdAt: new Date(),
        ...entity,
      })),
    };
    profileRepo = {
      createQueryBuilder: jest.fn(),
      exists: jest.fn().mockResolvedValue(true),
    };
    mockOwnProfile({ id: 'profile-1' });

    txAssessmentRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((data) => ({ ...data })),
      save: jest.fn(async (entity) => ({
        id: entity.id ?? 'tx-assessment',
        ...entity,
      })),
    };
    txResponseRepo = { delete: jest.fn(), insert: jest.fn() };
    const manager = {
      getRepository: jest.fn((entity) =>
        entity === PersonalityResponse ? txResponseRepo : txAssessmentRepo,
      ),
    };
    const dataSource = { transaction: jest.fn((cb) => cb(manager)) };
    auditEmitter = { emit: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PersonalityService,
        {
          provide: getRepositoryToken(PersonalityQuestion),
          useValue: questionRepo,
        },
        {
          provide: getRepositoryToken(PersonalityAssessment),
          useValue: assessmentRepo,
        },
        { provide: getRepositoryToken(Profile), useValue: profileRepo },
        { provide: DataSource, useValue: dataSource },
        {
          provide: PERSONALITY_COMPATIBILITY_PROVIDER,
          useClass: RuleBasedCompatibilityProvider,
        },
        { provide: AuditEmitter, useValue: auditEmitter },
        {
          provide: CustomLoggerService,
          useValue: { log: jest.fn(), error: jest.fn() },
        },
      ],
    }).compile();

    service = module.get(PersonalityService);
  });

  // ─── Questions ─────────────────────────────────────────────────────────────

  describe('getQuestions', () => {
    it('returns active questions without score mappings', async () => {
      const result = await service.getQuestions();
      expect(result.totalQuestions).toBe(32);
      expect(result.locale).toBe('en');
      expect(result.questions[0].options).toHaveLength(5);
      expect(result.questions[0].options[0]).toEqual({
        id: 11,
        key: 'STRONGLY_AGREE',
        text: 'Strongly Agree',
        displayOrder: 1,
      });
      expect(JSON.stringify(result)).not.toMatch(/scoreValue|scoreDirection/);
    });

    it('localises with base-language and default fallback', async () => {
      const result = await service.getQuestions('ta-IN');
      expect(result.questions.find((q) => q.id === 1).text).toBe(
        'நான் கவனத்தின் மையமாக இருப்பதை விரும்புகிறேன்.',
      );
      expect(result.questions.find((q) => q.id === 2).text).toBe(
        'Social gatherings energize me.',
      );
    });

    it('caches the question bank', async () => {
      await service.getQuestions();
      await service.getQuestions('ta');
      expect(questionRepo.find).toHaveBeenCalledTimes(1);

      service.invalidateQuestionCache();
      await service.getQuestions();
      expect(questionRepo.find).toHaveBeenCalledTimes(2);
    });
  });

  // ─── Start ─────────────────────────────────────────────────────────────────

  describe('startAssessment', () => {
    it("creates an assessment for the member's own profile", async () => {
      const result = await service.startAssessment(MEMBER, {});
      expect(assessmentRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          profileId: 'profile-1',
          status: AssessmentStatus.IN_PROGRESS,
        }),
      );
      expect(result).toMatchObject({
        assessmentId: 'new-assessment',
        profileId: 'profile-1',
        totalQuestions: 32,
        resumed: false,
      });
    });

    it('resumes an open assessment instead of creating another', async () => {
      assessmentRepo.findOne.mockResolvedValue({
        id: 'open-1',
        profileId: 'profile-1',
        status: AssessmentStatus.IN_PROGRESS,
        createdAt: new Date(),
      });
      const result = await service.startAssessment(MEMBER, {});
      expect(assessmentRepo.save).not.toHaveBeenCalled();
      expect(result).toMatchObject({ assessmentId: 'open-1', resumed: true });
    });

    it("forbids a member from starting for someone else's profile", async () => {
      await expect(
        service.startAssessment(MEMBER, { profileId: 'profile-2' }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('lets an admin start for any existing profile', async () => {
      const result = await service.startAssessment(ADMIN, {
        profileId: 'profile-2',
      });
      expect(profileRepo.exists).toHaveBeenCalledWith({
        where: { id: 'profile-2' },
      });
      expect(result.profileId).toBe('profile-2');
    });

    it('requires the member to have a profile', async () => {
      mockOwnProfile(null);
      await expect(service.startAssessment(MEMBER, {})).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  // ─── Submit ────────────────────────────────────────────────────────────────

  describe('submitAssessment', () => {
    it('scores, persists responses and returns the result', async () => {
      txAssessmentRepo.findOne.mockResolvedValue({
        id: 'open-1',
        profileId: 'profile-1',
        status: AssessmentStatus.IN_PROGRESS,
      });

      const result = await service.submitAssessment(MEMBER, {
        responses: answerAll(LikertOptionKey.STRONGLY_AGREE),
      });

      expect(txAssessmentRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'open-1',
          status: AssessmentStatus.COMPLETED,
          personalityType: 'ESTJ',
          confidenceScore: 100,
          extroversionScore: 16,
          introversionScore: 0,
          sensingScore: 16,
          thinkingScore: 16,
          judgingScore: 16,
        }),
      );
      expect(txResponseRepo.delete).toHaveBeenCalledWith({
        assessmentId: 'open-1',
      });
      const inserted = txResponseRepo.insert.mock.calls[0][0];
      expect(inserted).toHaveLength(32);
      expect(inserted[0]).toMatchObject({
        assessmentId: 'open-1',
        questionId: 1,
        selectedOptionId: 11,
      });

      expect(auditEmitter.emit).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: AuditEventType.PERSONALITY_ASSESSMENT_COMPLETED,
          entityId: 'open-1',
          profileId: 'profile-1',
        }),
      );

      expect(result).toMatchObject({
        available: true,
        personalityType: 'ESTJ',
        confidence: { score: 100, level: ConfidenceLevel.HIGH },
        insights: { title: 'The Organizer' },
      });
      expect(result.dimensions.map((d) => d.dominant)).toEqual([
        'E',
        'S',
        'T',
        'J',
      ]);
      expect(result.dimensions[0]).toMatchObject({
        scores: { E: 16, I: 0 },
        percentages: { E: 100, I: 0 },
      });
    });

    it('creates the assessment when none is open', async () => {
      await service.submitAssessment(MEMBER, {
        responses: answerAll(LikertOptionKey.DISAGREE),
      });
      expect(txAssessmentRepo.create).toHaveBeenCalledWith({
        profileId: 'profile-1',
        status: AssessmentStatus.IN_PROGRESS,
      });
      expect(txAssessmentRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ personalityType: 'INFP' }),
      );
    });

    it('rejects incomplete answers before writing anything', async () => {
      const responses = answerAll(LikertOptionKey.AGREE).slice(0, 30);
      await expect(
        service.submitAssessment(MEMBER, { responses }),
      ).rejects.toThrow(/2 unanswered/);
      expect(txResponseRepo.insert).not.toHaveBeenCalled();
    });

    it('rejects duplicate answers to the same question', async () => {
      const responses = [
        ...answerAll(LikertOptionKey.AGREE),
        { questionId: 1, optionId: 12 },
      ];
      await expect(
        service.submitAssessment(MEMBER, { responses }),
      ).rejects.toThrow(/more than once/);
    });

    it('rejects an option from a different question', async () => {
      const responses = answerAll(LikertOptionKey.AGREE);
      responses[0] = { questionId: 1, optionId: 21 };
      await expect(
        service.submitAssessment(MEMBER, { responses }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects unknown questions', async () => {
      const responses = [
        ...answerAll(LikertOptionKey.AGREE),
        { questionId: 999, optionId: 9991 },
      ];
      await expect(
        service.submitAssessment(MEMBER, { responses }),
      ).rejects.toThrow(/not part of the active assessment/);
    });

    it('refuses to re-submit a completed assessment', async () => {
      txAssessmentRepo.findOne.mockResolvedValue({
        id: 'done-1',
        profileId: 'profile-1',
        status: AssessmentStatus.COMPLETED,
      });
      await expect(
        service.submitAssessment(MEMBER, {
          assessmentId: 'done-1',
          responses: answerAll(LikertOptionKey.AGREE),
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('refuses an assessment that belongs to another profile', async () => {
      txAssessmentRepo.findOne.mockResolvedValue({
        id: 'other-1',
        profileId: 'profile-9',
        status: AssessmentStatus.IN_PROGRESS,
      });
      await expect(
        service.submitAssessment(MEMBER, {
          assessmentId: 'other-1',
          responses: answerAll(LikertOptionKey.AGREE),
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  // ─── Results & compatibility ───────────────────────────────────────────────

  describe('getProfileResult', () => {
    it('reports unavailable when the member has not completed the assessment', async () => {
      const result = await service.getProfileResult('profile-x');
      expect(result).toEqual({
        available: false,
        message: expect.stringContaining('not completed'),
      });
    });

    it('returns the latest completed result with insights', async () => {
      assessmentRepo.findOne.mockResolvedValue(
        completedAssessment('profile-1'),
      );
      const result = await service.getProfileResult('profile-1');
      expect(assessmentRepo.findOne).toHaveBeenCalledWith({
        where: { profileId: 'profile-1', status: AssessmentStatus.COMPLETED },
        order: { completedDate: 'DESC' },
      });
      expect(result).toMatchObject({
        available: true,
        personalityType: 'INFJ',
        insights: { title: 'The Counselor' },
      });
    });
  });

  describe('getCompatibility', () => {
    it('returns the exact unavailable message when either member has not completed', async () => {
      assessmentRepo.findOne.mockImplementation(({ where }) =>
        Promise.resolve(
          where.profileId === 'profile-a'
            ? completedAssessment('profile-a')
            : null,
        ),
      );

      await expect(
        service.getCompatibility('profile-a', 'profile-b'),
      ).resolves.toEqual({
        available: false,
        message: PERSONALITY_UNAVAILABLE_MESSAGE,
      });
    });

    it('compares two completed assessments', async () => {
      assessmentRepo.findOne.mockImplementation(({ where }) =>
        Promise.resolve(
          where.profileId === 'profile-a'
            ? completedAssessment('profile-a')
            : completedAssessment('profile-b', {
                personalityType: 'ENFP',
                extroversionScore: 13,
                introversionScore: 3,
                judgingScore: 4,
                perceivingScore: 12,
              }),
        ),
      );

      const result = await service.getCompatibility('profile-a', 'profile-b');

      expect(result.available).toBe(true);
      expect(result.profiles).toEqual([
        { profileId: 'profile-a', personalityType: 'INFJ' },
        { profileId: 'profile-b', personalityType: 'ENFP' },
      ]);
      expect(result.compatibilityScore).toBeGreaterThan(0);
      expect(result.communicationStyle.label).toBe('Warm & Inspirational');
      expect(result.strengths).toHaveLength(4);
      expect(result.potentialChallenges).toHaveLength(4);
      expect(result.analysisVersion).toBe('rule-based-v1');
    });

    it('rejects comparing a profile with itself', async () => {
      await expect(
        service.getCompatibility('profile-a', 'profile-a'),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});
