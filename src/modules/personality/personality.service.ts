import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';

import { Profile } from '../user/entity';
import { UserRole } from 'src/common/enums/role.enum';
import { CustomLoggerService } from '../logger/custom-logger.service';
import { AuditEmitter } from '../audit/audit.emitter';
import { AuditEventType } from '../audit/enums/audit-event-type.enum';
import { AuditEntityType } from '../audit/enums/audit-entity-type.enum';

import { PersonalityQuestion } from './entities/personality-question.entity';
import { PersonalityQuestionOption } from './entities/personality-question-option.entity';
import { PersonalityAssessment } from './entities/personality-assessment.entity';
import { PersonalityResponse } from './entities/personality-response.entity';
import {
  AssessmentStatus,
  DIMENSION_LABELS,
  DIMENSION_ORDER,
  PERSONALITY_UNAVAILABLE_MESSAGE,
  POLE_LABELS,
  PROFILE_RESULT_UNAVAILABLE_MESSAGE,
  PersonalityTypeCode,
} from './enums/personality.enums';
import {
  PoleScores,
  PersonalityScoringResult,
  dominantPole,
  polePercentages,
  scoreAssessment,
  toConfidenceLevel,
} from './scoring/personality-scoring.engine';
import {
  PERSONALITY_COMPATIBILITY_PROVIDER,
  PersonalityCompatibilityProvider,
  PersonalitySnapshot,
} from './compatibility/personality-compatibility-provider.interface';
import { PERSONALITY_TYPE_PROFILES } from './constants/personality-type-profiles';
import { PersonalityQuestionsResponseDto } from './dto/question-response.dto';
import { StartAssessmentDto } from './dto/start-assessment.dto';
import {
  AssessmentAnswerDto,
  SubmitAssessmentDto,
} from './dto/submit-assessment.dto';
import {
  AssessmentResultDto,
  DimensionScoreDto,
  StartAssessmentResponseDto,
} from './dto/assessment-result.dto';
import { PersonalityCompatibilityResponseDto } from './dto/compatibility-result.dto';

/** The subset of `req.user` this service relies on. */
export interface PersonalityRequestUser {
  id: string;
  role?: string;
}

interface ValidatedAnswer {
  question: PersonalityQuestion;
  option: PersonalityQuestionOption;
}

@Injectable()
export class PersonalityService {
  private readonly ctx = PersonalityService.name;

  // The question bank changes only via migrations, so a short per-instance
  // cache keeps GET /questions and submit validation off the DB.
  static readonly QUESTION_CACHE_TTL_MS = 5 * 60 * 1000;
  private questionCache: {
    loadedAt: number;
    questions: PersonalityQuestion[];
  } | null = null;

  constructor(
    @InjectRepository(PersonalityQuestion)
    private readonly questionRepo: Repository<PersonalityQuestion>,
    @InjectRepository(PersonalityAssessment)
    private readonly assessmentRepo: Repository<PersonalityAssessment>,
    @InjectRepository(Profile)
    private readonly profileRepo: Repository<Profile>,
    private readonly dataSource: DataSource,
    @Inject(PERSONALITY_COMPATIBILITY_PROVIDER)
    private readonly compatibilityProvider: PersonalityCompatibilityProvider,
    private readonly auditEmitter: AuditEmitter,
    private readonly logger: CustomLoggerService,
  ) {}

  // ─── Questions ─────────────────────────────────────────────────────────────

  async getQuestions(lang?: string): Promise<PersonalityQuestionsResponseDto> {
    const questions = await this.getActiveQuestions();

    return {
      locale: lang ?? 'en',
      totalQuestions: questions.length,
      questions: questions.map((q) => ({
        id: q.id,
        code: q.questionCode,
        text: this.localize(q.questionText, q.translations, lang),
        dimension: q.dimension,
        displayOrder: q.displayOrder,
        options: q.options.map((o) => ({
          id: o.id,
          key: o.optionKey,
          text: this.localize(o.optionText, o.translations, lang),
          displayOrder: o.displayOrder,
        })),
      })),
    };
  }

  /** Clears the question cache — call after changing the bank at runtime. */
  invalidateQuestionCache(): void {
    this.questionCache = null;
  }

  // ─── Assessment lifecycle ──────────────────────────────────────────────────

  /**
   * Opens an assessment for the profile. Idempotent: if one is already
   * IN_PROGRESS it is returned (`resumed: true`) instead of creating another.
   */
  async startAssessment(
    user: PersonalityRequestUser,
    dto: StartAssessmentDto,
  ): Promise<StartAssessmentResponseDto> {
    const profileId = await this.resolveProfileId(user, dto.profileId);
    const questions = await this.getActiveQuestions();

    const open = await this.assessmentRepo.findOne({
      where: { profileId, status: AssessmentStatus.IN_PROGRESS },
      order: { createdAt: 'DESC' },
    });

    const assessment =
      open ??
      (await this.assessmentRepo.save(
        this.assessmentRepo.create({
          profileId,
          status: AssessmentStatus.IN_PROGRESS,
        }),
      ));

    return {
      assessmentId: assessment.id,
      profileId,
      status: assessment.status,
      startedAt: assessment.createdAt,
      totalQuestions: questions.length,
      resumed: !!open,
    };
  }

  /**
   * Scores and persists a full set of answers.
   *
   * Validation (every active question answered exactly once, each option
   * belonging to its question) happens before any write. Responses and the
   * result are then written in one transaction, with the assessment row locked
   * so a double-submit can't score the same attempt twice.
   */
  async submitAssessment(
    user: PersonalityRequestUser,
    dto: SubmitAssessmentDto,
  ): Promise<AssessmentResultDto> {
    const profileId = await this.resolveProfileId(user, dto.profileId);
    const questions = await this.getActiveQuestions();
    if (questions.length === 0) {
      throw new ServiceUnavailableException(
        'The personality assessment is not available right now.',
      );
    }

    const answers = this.validateAnswers(dto.responses, questions);
    const scoring = scoreAssessment(
      answers.map(({ question, option }) => ({
        dimension: question.dimension,
        scoreDirection: option.scoreDirection,
        scoreValue: option.scoreValue,
        maxScoreValue: Math.max(...question.options.map((o) => o.scoreValue)),
      })),
    );

    const assessment = await this.dataSource.transaction(async (manager) => {
      const target = await this.lockTargetAssessment(
        manager,
        profileId,
        dto.assessmentId,
      );

      this.applyScoring(target, scoring);
      const saved = await manager
        .getRepository(PersonalityAssessment)
        .save(target);

      const responseRepo = manager.getRepository(PersonalityResponse);
      await responseRepo.delete({ assessmentId: saved.id });
      await responseRepo.insert(
        answers.map(({ question, option }) => ({
          id: uuidv4(),
          assessmentId: saved.id,
          questionId: question.id,
          selectedOptionId: option.id,
        })),
      );

      return saved;
    });

    this.auditEmitter.emit({
      eventType: AuditEventType.PERSONALITY_ASSESSMENT_COMPLETED,
      entityType: AuditEntityType.PERSONALITY_ASSESSMENT,
      entityId: assessment.id,
      userId: user.id,
      profileId,
      newValue: {
        personalityType: assessment.personalityType,
        confidenceScore: assessment.confidenceScore,
      },
      description: `Personality assessment completed (${assessment.personalityType})`,
    });

    this.logger.log(
      `Personality assessment ${assessment.id} completed for profile ${profileId}: ${assessment.personalityType}`,
      this.ctx,
    );

    return this.toResult(assessment);
  }

  // ─── Results ───────────────────────────────────────────────────────────────

  async getMyResult(
    user: PersonalityRequestUser,
  ): Promise<AssessmentResultDto> {
    const profileId = await this.resolveProfileId(user);
    return this.getProfileResult(profileId);
  }

  async getProfileResult(profileId: string): Promise<AssessmentResultDto> {
    const assessment = await this.getLatestCompletedAssessment(profileId);
    if (!assessment)
      return { available: false, message: PROFILE_RESULT_UNAVAILABLE_MESSAGE };
    return this.toResult(assessment);
  }

  async getCompatibility(
    profileIdA: string,
    profileIdB: string,
  ): Promise<PersonalityCompatibilityResponseDto> {
    if (profileIdA === profileIdB) {
      throw new BadRequestException(
        'Choose two different profiles to compare.',
      );
    }

    const [a, b] = await Promise.all([
      this.getLatestCompletedAssessment(profileIdA),
      this.getLatestCompletedAssessment(profileIdB),
    ]);
    if (!a || !b)
      return { available: false, message: PERSONALITY_UNAVAILABLE_MESSAGE };

    const result = await this.compatibilityProvider.evaluate(
      this.toSnapshot(a),
      this.toSnapshot(b),
    );

    return {
      available: true,
      profiles: [
        { profileId: a.profileId, personalityType: a.personalityType },
        { profileId: b.profileId, personalityType: b.personalityType },
      ],
      ...result,
      analysisVersion: this.compatibilityProvider.version,
    };
  }

  /**
   * A profile's current result (latest COMPLETED attempt), or null.
   * Exported for other modules — e.g. folding personality into match scoring.
   */
  getLatestCompletedAssessment(
    profileId: string,
  ): Promise<PersonalityAssessment | null> {
    return this.assessmentRepo.findOne({
      where: { profileId, status: AssessmentStatus.COMPLETED },
      order: { completedDate: 'DESC' },
    });
  }

  /**
   * Current personality type for many profiles in one query (profileId → type),
   * for list views such as search results. Profiles that haven't completed the
   * assessment are simply absent from the map. Served by
   * IDX_PERSONALITY_ASSESSMENTS_PROFILE_STATUS.
   */
  async getPersonalityTypes(profileIds: string[]): Promise<Map<string, string>> {
    const ids = [...new Set(profileIds.filter(Boolean))];
    const types = new Map<string, string>();
    if (ids.length === 0) return types;

    const rows: { profileId: string; personalityType: string }[] =
      await this.assessmentRepo
        .createQueryBuilder('a')
        .select('a.profileId', 'profileId')
        .addSelect('a.personalityType', 'personalityType')
        .where('a.status = :status', { status: AssessmentStatus.COMPLETED })
        .andWhere('a.profileId IN (:...ids)', { ids })
        .orderBy('a.completedDate', 'DESC')
        .getRawMany();

    // Newest first, so the first row per profile is its current result (retakes).
    for (const row of rows) {
      if (row.personalityType && !types.has(row.profileId)) {
        types.set(row.profileId, row.personalityType);
      }
    }
    return types;
  }

  // ─── Internals ─────────────────────────────────────────────────────────────

  private async getActiveQuestions(): Promise<PersonalityQuestion[]> {
    const now = Date.now();
    if (
      this.questionCache &&
      now - this.questionCache.loadedAt <
        PersonalityService.QUESTION_CACHE_TTL_MS
    ) {
      return this.questionCache.questions;
    }

    const questions = await this.questionRepo.find({
      where: { activeFlag: true },
      relations: { options: true },
      order: { displayOrder: 'ASC', options: { displayOrder: 'ASC' } },
    });

    this.questionCache = { loadedAt: now, questions };
    return questions;
  }

  /**
   * Members act on their own profile; admins may act on any existing profile.
   * With no profileId requested, the caller's own profile is used.
   */
  private async resolveProfileId(
    user: PersonalityRequestUser,
    requestedProfileId?: string,
  ): Promise<string> {
    if (requestedProfileId && user.role === UserRole.Admin) {
      const exists = await this.profileRepo.exists({
        where: { id: requestedProfileId },
      });
      if (!exists) throw new NotFoundException('Profile not found.');
      return requestedProfileId;
    }

    const own = await this.profileRepo
      .createQueryBuilder('p')
      .innerJoin('p.user', 'u')
      .where('u.id = :userId', { userId: user.id })
      .select(['p.id'])
      .getOne();

    if (!own) {
      throw new NotFoundException(
        'Create your matrimony profile before taking the personality assessment.',
      );
    }
    if (requestedProfileId && requestedProfileId !== own.id) {
      throw new ForbiddenException(
        'You can only take the personality assessment for your own profile.',
      );
    }
    return own.id;
  }

  private validateAnswers(
    responses: AssessmentAnswerDto[],
    questions: PersonalityQuestion[],
  ): ValidatedAnswer[] {
    const byId = new Map(questions.map((q) => [q.id, q]));
    const answered = new Set<number>();
    const answers: ValidatedAnswer[] = [];

    for (const response of responses) {
      if (answered.has(response.questionId)) {
        throw new BadRequestException(
          `Question ${response.questionId} was answered more than once.`,
        );
      }
      answered.add(response.questionId);

      const question = byId.get(response.questionId);
      if (!question) {
        throw new BadRequestException(
          `Question ${response.questionId} is not part of the active assessment.`,
        );
      }
      const option = question.options.find((o) => o.id === response.optionId);
      if (!option) {
        throw new BadRequestException(
          `Option ${response.optionId} does not belong to question ${response.questionId}.`,
        );
      }
      answers.push({ question, option });
    }

    const missing = questions
      .filter((q) => !answered.has(q.id))
      .map((q) => q.id);
    if (missing.length > 0) {
      throw new BadRequestException(
        `All ${questions.length} questions must be answered; ${missing.length} unanswered (question ids: ${missing.join(', ')}).`,
      );
    }

    return answers;
  }

  /**
   * Picks the assessment to complete, row-locked for the transaction:
   * the requested one, else the profile's open one, else a new one.
   */
  private async lockTargetAssessment(
    manager: EntityManager,
    profileId: string,
    assessmentId?: string,
  ): Promise<PersonalityAssessment> {
    const repo = manager.getRepository(PersonalityAssessment);

    if (assessmentId) {
      const assessment = await repo.findOne({
        where: { id: assessmentId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!assessment || assessment.profileId !== profileId) {
        throw new NotFoundException('Assessment not found for this profile.');
      }
      if (assessment.status === AssessmentStatus.COMPLETED) {
        throw new ConflictException(
          'This assessment has already been submitted. Start a new assessment to retake it.',
        );
      }
      return assessment;
    }

    const open = await repo.findOne({
      where: { profileId, status: AssessmentStatus.IN_PROGRESS },
      order: { createdAt: 'DESC' },
      lock: { mode: 'pessimistic_write' },
    });
    return (
      open ?? repo.create({ profileId, status: AssessmentStatus.IN_PROGRESS })
    );
  }

  private applyScoring(
    assessment: PersonalityAssessment,
    scoring: PersonalityScoringResult,
  ): void {
    const s = scoring.poleScores;
    assessment.status = AssessmentStatus.COMPLETED;
    assessment.completedDate = new Date();
    assessment.personalityType = scoring.personalityType;
    assessment.confidenceScore = scoring.confidenceScore;
    assessment.extroversionScore = s.E;
    assessment.introversionScore = s.I;
    assessment.sensingScore = s.S;
    assessment.intuitionScore = s.N;
    assessment.thinkingScore = s.T;
    assessment.feelingScore = s.F;
    assessment.judgingScore = s.J;
    assessment.perceivingScore = s.P;
  }

  private poleScoresOf(a: PersonalityAssessment): PoleScores {
    return {
      E: a.extroversionScore,
      I: a.introversionScore,
      S: a.sensingScore,
      N: a.intuitionScore,
      T: a.thinkingScore,
      F: a.feelingScore,
      J: a.judgingScore,
      P: a.perceivingScore,
    };
  }

  private toSnapshot(a: PersonalityAssessment): PersonalitySnapshot {
    return {
      profileId: a.profileId,
      personalityType: a.personalityType,
      poleScores: this.poleScoresOf(a),
      confidenceScore: a.confidenceScore ?? 0,
    };
  }

  private toResult(a: PersonalityAssessment): AssessmentResultDto {
    const scores = this.poleScoresOf(a);
    const confidenceScore = a.confidenceScore ?? 0;

    const dimensions: DimensionScoreDto[] = DIMENSION_ORDER.map((dimension) => {
      const dominant = dominantPole(scores, dimension);
      const percentages = polePercentages(scores, dimension);
      return {
        dimension,
        label: DIMENSION_LABELS[dimension],
        dominant,
        dominantLabel: POLE_LABELS[dominant],
        scores: Object.fromEntries(
          Object.keys(percentages).map((pole) => [pole, scores[pole]]),
        ),
        percentages,
      };
    });

    return {
      available: true,
      assessmentId: a.id,
      profileId: a.profileId,
      personalityType: a.personalityType,
      completedDate: a.completedDate,
      confidence: {
        score: confidenceScore,
        level: toConfidenceLevel(confidenceScore),
      },
      dimensions,
      insights:
        PERSONALITY_TYPE_PROFILES[a.personalityType as PersonalityTypeCode],
    };
  }

  /** Locale lookup with base-language fallback: ta-IN → ta → default text. */
  private localize(
    base: string,
    translations: Record<string, string> | null,
    lang?: string,
  ): string {
    if (!lang || !translations) return base;
    return translations[lang] ?? translations[lang.split('-')[0]] ?? base;
  }
}
