import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import Anthropic from '@anthropic-ai/sdk';
import { HoroscopeCompatibilityReport, Match, Profile, User, UserSubscription } from '../user/entity';
import { Interest } from '../interests/entity/interest.entity';
import { EDUCATION_TIER } from './matches-lookup';
import { scoreAgeGap, scoreIncome, scoreMotherTongue, computeCompatibilityRules, generateBadges } from '../../shared/matches/matches.helper';
import { Badge } from 'src/shared/matches/matches.model';
import { InterestsService } from '../interests/interests.service';
import { match } from 'assert';

type TextBlock = Anthropic.Messages.TextBlock;

@Injectable()
export class MatchesService {
  private readonly MAX_CANDIDATES = 20; // Max profiles to consider when generating matches
  private PREMIUM_TIERS = new Set(['gold', 'platinum']);
  private FEATURE_GATE_MSG = 'AI-powered compatibility report is available for Gold and Platinum members only. ' +
  'Please upgrade your membership to access this feature.';


  constructor(
    @InjectRepository(Match) private readonly matchRepo: Repository<Match>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(Profile) private readonly profileRepo: Repository<Profile>,
    @InjectRepository(Interest) private readonly interestRepo: Repository<Interest>,
    @InjectRepository(UserSubscription) private readonly userSubscriptionRepo: Repository<UserSubscription>,
    @InjectRepository(HoroscopeCompatibilityReport) private readonly horoscopeReportRepo: Repository<HoroscopeCompatibilityReport>,
    private readonly interestService: InterestsService,
    private readonly anthropic: Anthropic,
  ) {}

  async generateMatches(userId: string, count = 4) {
    const user = await this.userRepo.findOne({
      where: { id: userId },
      relations: ['profile'],
    });
    if (!user?.profile) throw new NotFoundException('User profile not found');

    const oppositeGender = user.gender === 'bride' ? 'groom' : 'bride';

    const candidates = await this.profileRepo.createQueryBuilder('p')
      .leftJoinAndSelect('p.photos', 'photos')
      .leftJoinAndSelect('p.user', 'u')
      .where('p.gender = :gender', { gender: oppositeGender })
      .andWhere('p.status = :status', { status: 'active' })
      .andWhere('p.is_searchable = :isSearchable', { isSearchable: 1 })
      .andWhere('u.id != :userId', { userId })
      .orderBy('RAND()')
      .take(count)
      .getMany();

    // Single batch query — find which candidates already have a stored match record.
    // Guard the empty case: In([]) can behave oddly across drivers, and there is
    // nothing to look up when no candidates were pulled.
    const candidateUserIds = candidates.map(c => c.user.id);
    const existingMatches = candidateUserIds.length
      ? await this.matchRepo.find({
          where: { userId, matchedUserId: In(candidateUserIds) },
        })
      : [];
    const existingMatchMap = new Map(existingMatches.map(m => [m.matchedUserId, m]));

    // Upsert each candidate: update the existing row in place, or insert a new one.
    // This prevents duplicate (userId, matchedUserId) rows. AI enrichment runs ONLY
    // for brand-new matches — existing rows keep their cached explanation/badges and
    // just get their rule-based scores + suggestedAt refreshed.
    const savedMatches = await Promise.all(
      candidates.map(async (candidate) => {
        const candidateUserId = candidate.user.id;
        const baseScores = computeCompatibilityRules(user.profile, candidate);
        const existing = existingMatchMap.get(candidateUserId);

        if (existing) {
          existing.matchPercentage = baseScores.total;
          existing.compatibilityBreakdown = baseScores.breakdown;
          existing.suggestedAt = new Date();
          return this.matchRepo.save(existing);
        }

        const enriched = await this.enrichWithAI(user.profile, candidate, baseScores);
        return this.matchRepo.save(
          this.matchRepo.create({
            userId,
            matchedUserId: candidateUserId,
            matchPercentage: baseScores.total,
            compatibilityBreakdown: baseScores.breakdown,
            explanationText: enriched.explanation,
            badges: enriched.badges,
            status: 'suggested',
          }),
        );
      }),
    );

    // Consolidate all match IDs (updated + newly inserted)
    const allMatchIds = savedMatches.map(m => m.id);

    const matchesWithRelations = await this.matchRepo.find({
      where: { id: In(allMatchIds) },
      relations: ['matchedUser', 'matchedUser.profile', 'matchedUser.profile.photos'],
      order: { matchPercentage: 'DESC' },
    });

    // Attach the interest status (pending/accepted/declined) between the current
    // user and each matched user, looked up in either direction.
    const interestStatusMap = await this.buildInterestStatusMap(
      userId,
      matchesWithRelations.map(m => m.matchedUserId),
    );

    return this.formatMatches(matchesWithRelations, interestStatusMap);
  }

  /**
   * Build a map of `otherUserId -> interest status` for the given user against a set
   * of other users. An interest between the pair is matched in EITHER direction
   * (current user as sender or receiver). When more than one interest exists for a
   * pair, the most recent one wins.
   */
  private async buildInterestStatusMap(
    userId: string,
    otherUserIds: string[],
  ): Promise<Map<string, string>> {
    const map = new Map<string, string>();
    if (!otherUserIds.length) return map;

    const interests = await this.interestRepo.find({
      where: [
        { fromUserId: userId, toUserId: In(otherUserIds) },
        { toUserId: userId, fromUserId: In(otherUserIds) },
      ],
      order: { createdAt: 'DESC' },
    });

    for (const interest of interests) {
      // The counterpart user relative to the current user
      const otherId = interest.fromUserId === userId ? interest.toUserId : interest.fromUserId;
      // Ordered by createdAt DESC, so the first entry seen is the latest — keep it.
      if (!map.has(otherId)) map.set(otherId, interest.status);
    }
    return map;
  }

  async generateRandomMatches(userId: string, count = 4) {
    const user = await this.userRepo.findOne({
      where: { id: userId },
      relations: ['profile'],
    });
    if (!user?.profile) throw new NotFoundException('User profile not found');

    const oppositeGender = user.gender === 'bride' ? 'groom' : 'bride';

    // Find candidate profiles — leftJoinAndSelect 'p.user' so candidate.user.id is available
    const candidates = await this.profileRepo.createQueryBuilder('p')
      .leftJoinAndSelect('p.photos', 'photos')
      .leftJoinAndSelect('p.user', 'u')
      .where('p.gender = :gender', { gender: oppositeGender })
      .andWhere('p.status = :status', { status: 'active' })
      .andWhere('p.is_searchable = :isSearchable', { isSearchable: 1 })
      .andWhere('u.id != :userId', { userId })
      .orderBy('RAND()')
      .take(count)
      .getMany();

    const matchIds: string[] = [];
    for (const candidate of candidates) {
      // candidate.user.id is the FK that matchedUserId references (User.id, not Profile.id)
      const candidateUserId = candidate.user.id;
      const compatibility = this.computeCompatibility(user.profile, candidate);

      // Check if match already exists
      const existing = await this.matchRepo.findOne({
        where: { userId, matchedUserId: candidateUserId },
      });

      if (existing) {
        existing.matchPercentage = compatibility.total;
        existing.compatibilityBreakdown = compatibility.breakdown;
        existing.explanationText = compatibility.explanation;
        existing.badges = compatibility.badges;
        const saved = await this.matchRepo.save(existing);
        matchIds.push(saved.id);
      } else {
        const match = this.matchRepo.create({
          userId,
          matchedUserId: candidateUserId,
          matchPercentage: compatibility.total,
          compatibilityBreakdown: compatibility.breakdown,
          explanationText: compatibility.explanation,
          badges: compatibility.badges,
          status: 'suggested',
        });
        const saved = await this.matchRepo.save(match);
        matchIds.push(saved.id);
      }
    }

    // Re-fetch saved matches with full relations so formatMatches has profile data
    const matchesWithRelations = await this.matchRepo.find({
      where: { id: In(matchIds) },
      relations: ['matchedUser', 'matchedUser.profile', 'matchedUser.profile.photos'],
      order: { matchPercentage: 'DESC' },
    });

    return this.formatMatches(matchesWithRelations);
  }

  async getMatches(userId: string) {
    const matches = await this.matchRepo.find({
      where: { userId },
      relations: ['matchedUser', 'matchedUser.profile', 'matchedUser.profile.photos'],
      order: { suggestedAt: 'DESC' },
    });

    // Attach the interest status (pending/accepted/declined) between the current
    // user and each matched user, looked up in either direction.
    const interestStatusMap = await this.buildInterestStatusMap(
      userId,
      matches.map(m => m.matchedUserId),
    );    
    return this.formatMatches(matches, interestStatusMap);
  }

  async getMatchesByUsers(userId: string, matchedUserId: string) {
    const match = await this.matchRepo.findOne({
      where: { userId, matchedUserId },
      relations: ['matchedUser', 'matchedUser.profile', 'matchedUser.profile.photos'],
      order: { suggestedAt: 'DESC' },
    });
    return this.formatMatch(match);
  }

  async getAIMatchesByUsers(userId: string, matchedUserId: string) {

    const subscription = await this.userSubscriptionRepo.findOne({
      where: { userId, status: 'active' },
    });

    // No active subscription found at all
    if (!subscription) {
      throw new ForbiddenException(this.FEATURE_GATE_MSG);
    }

    // Tier is not in the allowed premium set
    if (!this.PREMIUM_TIERS.has(subscription.tier)) {
      throw new ForbiddenException(this.FEATURE_GATE_MSG);
    }
    
    // Active + premium tier, but endDate has lapsed (data integrity safety net)
    if (subscription.endDate && subscription.endDate < new Date()) {
      throw new ForbiddenException(
        `Your ${subscription.tier} membership expired on ` +
        `${subscription.endDate.toDateString()}. ` +
        `Please renew to access AI-powered compatibility reports.`
      );
    }    


    const [[currentUser, matchedUser], match] = await Promise.all([
      Promise.all([
        this.userRepo.findOne({ where: { id: userId }, relations: ['profile', 'profile.photos'] }),
        this.userRepo.findOne({ where: { id: matchedUserId }, relations: ['profile', 'profile.photos'] }),
      ]),
      this.matchRepo.findOne({
        where: { userId, matchedUserId },
        relations: ['matchedUser', 'matchedUser.profile', 'matchedUser.profile.photos'],
      }),
    ]);

    if (!currentUser?.profile) throw new NotFoundException('Current user profile not found');
    if (!matchedUser?.profile) throw new NotFoundException('Matched user profile not found');

    const userOneHoroscope = this.extractHoroscopeData(currentUser.profile);
    const userTwoHoroscope = this.extractHoroscopeData(matchedUser.profile);

    const cached = await this.findCachedReport(userId, matchedUserId, userOneHoroscope, userTwoHoroscope);

    let horoscopeReport: Record<string, any>;
    if (cached) {
      horoscopeReport = cached.report;
    } else {
      horoscopeReport = await this.analyzeHoroscopeCompatibility(
        { name: currentUser.profile.firstName, ...userOneHoroscope },
        { name: matchedUser.profile.firstName, ...userTwoHoroscope },
      );

      await this.horoscopeReportRepo.save(
        this.horoscopeReportRepo.create({
          userOneId: userId,
          userTwoId: matchedUserId,
          userOneDateOfBirth: userOneHoroscope.dateOfBirth,
          userOneTimeOfBirth: userOneHoroscope.timeOfBirth,
          userOnePlaceOfBirth: userOneHoroscope.placeOfBirth,
          userTwoDateOfBirth: userTwoHoroscope.dateOfBirth,
          userTwoTimeOfBirth: userTwoHoroscope.timeOfBirth,
          userTwoPlaceOfBirth: userTwoHoroscope.placeOfBirth,
          report: horoscopeReport,
        }),
      );
    }

    return {
      profiles: {
        userOne: this.formatProfileWithHoroscope(currentUser),
        userTwo: this.formatProfileWithHoroscope(matchedUser),
      },
      match: match ? this.formatMatch(match) : null,
      horoscopeReport,
      fromCache: !!cached,
    };
  }

  private async findCachedReport(
    userId: string,
    matchedUserId: string,
    userOneHoroscope: ReturnType<typeof this.extractHoroscopeData>,
    userTwoHoroscope: ReturnType<typeof this.extractHoroscopeData>,
  ) {
    return this.horoscopeReportRepo.findOne({
      where: [
        {
          userOneId: userId,
          userTwoId: matchedUserId,
          userOneDateOfBirth: userOneHoroscope.dateOfBirth,
          userOneTimeOfBirth: userOneHoroscope.timeOfBirth,
          userOnePlaceOfBirth: userOneHoroscope.placeOfBirth,
          userTwoDateOfBirth: userTwoHoroscope.dateOfBirth,
          userTwoTimeOfBirth: userTwoHoroscope.timeOfBirth,
          userTwoPlaceOfBirth: userTwoHoroscope.placeOfBirth,
        },
        {
          userOneId: matchedUserId,
          userTwoId: userId,
          userOneDateOfBirth: userTwoHoroscope.dateOfBirth,
          userOneTimeOfBirth: userTwoHoroscope.timeOfBirth,
          userOnePlaceOfBirth: userTwoHoroscope.placeOfBirth,
          userTwoDateOfBirth: userOneHoroscope.dateOfBirth,
          userTwoTimeOfBirth: userOneHoroscope.timeOfBirth,
          userTwoPlaceOfBirth: userOneHoroscope.placeOfBirth,
        },
      ],
    });
  }

  private extractHoroscopeData(profile: Profile) {
    return {
      dateOfBirth: profile.dateOfBirth ?? null,
      timeOfBirth: profile.horoscope?.timeOfBirth ?? null,
      placeOfBirth: profile.horoscope?.placeOfBirth ?? null,
      rashi: profile.horoscope?.rashi ?? null,
      nakshatra: profile.horoscope?.nakshatra ?? null,
      manglikStatus: profile.horoscope?.manglikStatus ?? null,
      documentUrl: profile.horoscopeDocUrl ?? null,
    };
  }

  private formatProfileWithHoroscope(user: User) {
    const p = user.profile;
    return {
      userId: user.id,
      profileId: p.id,
      firstName: p.firstName,
      lastName: p.lastName,
      age: p.age,
      gender: p.gender,
      religion: p.religion,
      motherTongue: p.motherTongue,
      dateOfBirth: p.dateOfBirth,
      height: p.height,
      weight: p.weight,
      complexion: p.complexion,
      aboutMe: p.aboutMe,
      familyDetails: { familyType: p.familyType, fatherOccupation: p.fatherOccupation, motherOccupation: p.motherOccupation, siblings: p.siblings, familyValues: p.familyValues },
      education: { level: p.educationLevel, field: p.educationField, institution: p.institution },
      occupation: { title: p.occupationTitle, company: p.company, annualIncome: p.annualIncome, workingStatus: p.workingStatus },
      horoscope: {
        timeOfBirth: p.horoscope?.timeOfBirth ?? null,
        placeOfBirth: p.horoscope?.placeOfBirth ?? null,
        rashi: p.horoscope?.rashi ?? null,
        nakshatra: p.horoscope?.nakshatra ?? null,
        manglikStatus: p.horoscope?.manglikStatus ?? null,
        documentUrl: p.horoscopeDocUrl ?? null,
      },
      location: { city: p.city, state: p.state, country: p.country, willingToRelocate: p.willingToRelocate },
      photos: (p.photos || []).map((ph) => ({ id: ph.id, url: ph.url, isPrimary: ph.isPrimary, isVerified: ph.isVerified })),
    };
  }

  private async analyzeHoroscopeCompatibility(
    userOne: { name: string; dateOfBirth: any; timeOfBirth: any; placeOfBirth: any; rashi: any; nakshatra: any; manglikStatus: any; documentUrl: any },
    userTwo: { name: string; dateOfBirth: any; timeOfBirth: any; placeOfBirth: any; rashi: any; nakshatra: any; manglikStatus: any; documentUrl: any },
  ) {
    const systemPrompt = `You are a world-class Vedic Astrology Expert with deep expertise in Kundli matching, Ashtakoot analysis, and Dosha assessment for matrimonial compatibility.
Analyze the horoscope details provided and return ONLY a single valid JSON object — no markdown, no commentary, no text outside the JSON.
Use balanced, constructive language. Avoid fear-based predictions. All scores must be integers.`;

    const userPrompt = `Act as a Vedic Astrology Expert for Suhana Matrimony.

Perform a full 11-feature horoscope compatibility analysis for the two individuals below and return the result as a single JSON object matching the exact structure provided.

=== PERSON 1 — ${userOne.name} ===
Date of Birth   : ${userOne.dateOfBirth ?? 'Not provided'}
Time of Birth   : ${userOne.timeOfBirth ?? 'Not provided'}
Place of Birth  : ${userOne.placeOfBirth ?? 'Not provided'}
Rashi           : ${userOne.rashi ?? 'Not provided'}
Nakshatra       : ${userOne.nakshatra ?? 'Not provided'}
Manglik Status  : ${userOne.manglikStatus ?? 'Not provided'}
Horoscope Doc   : ${userOne.documentUrl ? 'Uploaded' : 'Not uploaded'}

=== PERSON 2 — ${userTwo.name} ===
Date of Birth   : ${userTwo.dateOfBirth ?? 'Not provided'}
Time of Birth   : ${userTwo.timeOfBirth ?? 'Not provided'}
Place of Birth  : ${userTwo.placeOfBirth ?? 'Not provided'}
Rashi           : ${userTwo.rashi ?? 'Not provided'}
Nakshatra       : ${userTwo.nakshatra ?? 'Not provided'}
Manglik Status  : ${userTwo.manglikStatus ?? 'Not provided'}
Horoscope Doc   : ${userTwo.documentUrl ? 'Uploaded' : 'Not uploaded'}

=== INSTRUCTIONS ===

FEATURE 1 — Horoscope Generation:
Generate Birth Chart, Navamsa Chart, Lagna, Rasi, Nakshatra, and all 9 planet positions for each person.

FEATURE 2 — Kundli Matching (Ashtakoot):
Calculate all 8 gunas. Assign scores. Compute total out of 36 and compatibility percentage.
Compatibility categories: Highly Compatible (>31), Compatible (26-31), Moderately Compatible (18-25), Needs Understanding (12-17), Challenging Match (<12).

FEATURE 3 — Dosha Analysis:
Detect Manglik, Nadi, Bhakoot, Kaal Sarp, and Shani doshas. For each: detected status, severity, marriage impact, and remedies array. Use balanced, constructive language only.

FEATURE 4 — Planetary Compatibility:
For each of the 9 planets, provide both persons' placements and a compatibility summary.
Analyse 7 aspects: emotional, communication, marriageStability, romance, familyValues, personality, financial — each with a percentage score and explanation.
Provide marriage prospects text and a confidence score (0-100).

FEATURE 5 — Compatibility Dashboard:
Convert all findings into user-friendly relationship insights.
Provide overall score (0-100), category, and a plain-language summary.
Then score each of the 7 aspects (emotional, communication, romance, marriageStability, familyValues, financial, personality) with a % and explanation.

FEATURE 6 — Match Strengths:
Generate 5-10 concise strength statements (plain strings, no symbols).

FEATURE 7 — Areas for Mutual Understanding:
Generate 3-5 constructive, non-negative observations (plain strings).

FEATURE 8 — AI Match Summary:
Write a premium matrimony-style paragraph summary (3-5 sentences). Non-technical, user-friendly.

FEATURE 9 — Side-by-Side Comparison:
Return both persons' key astrological profile fields for direct comparison.

FEATURE 10 — Advanced Astrology Details:
Return all 9 planet positions for both persons, house placements, and Navamsa / Nakshatra / Rasi analyses.

FEATURE 11 — Final Recommendation:
Choose one category: "Excellent Match" | "Highly Recommended Match" | "Strong Match" | "Good Match" | "Moderate Match" | "Requires Further Consideration".
Provide a 2-3 sentence justification.

Return ONLY this JSON structure (fill every field — do not omit any key):
{
  "horoscopeGeneration": {
    "personOne": {
      "lagna": "", "rasi": "", "nakshatra": "", "navamsaLagna": "", "birthChart": "",
      "planetPositions": { "sun": "", "moon": "", "mars": "", "mercury": "", "jupiter": "", "venus": "", "saturn": "", "rahu": "", "ketu": "" },
      "housePlacements": {}
    },
    "personTwo": {
      "lagna": "", "rasi": "", "nakshatra": "", "navamsaLagna": "", "birthChart": "",
      "planetPositions": { "sun": "", "moon": "", "mars": "", "mercury": "", "jupiter": "", "venus": "", "saturn": "", "rahu": "", "ketu": "" },
      "housePlacements": {}
    }
  },
  "kundliMatching": {
    "varna":       { "score": 0, "maxScore": 1, "description": "" },
    "vashya":      { "score": 0, "maxScore": 2, "description": "" },
    "tara":        { "score": 0, "maxScore": 3, "description": "" },
    "yoni":        { "score": 0, "maxScore": 4, "description": "" },
    "grahaMaitri": { "score": 0, "maxScore": 5, "description": "" },
    "gana":        { "score": 0, "maxScore": 6, "description": "" },
    "bhakoot":     { "score": 0, "maxScore": 7, "description": "" },
    "nadi":        { "score": 0, "maxScore": 8, "description": "" },
    "totalScore": 0, "maxScore": 36, "compatibilityPercentage": 0, "compatibilityCategory": ""
  },
  "doshaAnalysis": {
    "manglik":  { "detected": false, "severity": "", "marriageImpact": "", "remedies": [] },
    "nadi":     { "detected": false, "severity": "", "marriageImpact": "", "remedies": [] },
    "bhakoot":  { "detected": false, "severity": "", "marriageImpact": "", "remedies": [] },
    "kaalSarp": { "detected": false, "severity": "", "marriageImpact": "", "remedies": [] },
    "shani":    { "detected": false, "severity": "", "marriageImpact": "", "remedies": [] }
  },
  "planetaryCompatibility": {
    "planets": {
      "sun":     { "personOne": "", "personTwo": "", "compatibility": "" },
      "moon":    { "personOne": "", "personTwo": "", "compatibility": "" },
      "mars":    { "personOne": "", "personTwo": "", "compatibility": "" },
      "mercury": { "personOne": "", "personTwo": "", "compatibility": "" },
      "jupiter": { "personOne": "", "personTwo": "", "compatibility": "" },
      "venus":   { "personOne": "", "personTwo": "", "compatibility": "" },
      "saturn":  { "personOne": "", "personTwo": "", "compatibility": "" },
      "rahu":    { "personOne": "", "personTwo": "", "compatibility": "" },
      "ketu":    { "personOne": "", "personTwo": "", "compatibility": "" }
    },
    "aspects": {
      "emotional":        { "score": 0, "explanation": "" },
      "communication":    { "score": 0, "explanation": "" },
      "marriageStability":{ "score": 0, "explanation": "" },
      "romance":          { "score": 0, "explanation": "" },
      "familyValues":     { "score": 0, "explanation": "" },
      "personality":      { "score": 0, "explanation": "" },
      "financial":        { "score": 0, "explanation": "" }
    },
    "marriageProspects": "", "confidenceScore": 0
  },
  "compatibilityDashboard": {
    "overallScore": 0, "category": "", "summary": "",
    "emotional":         { "score": 0, "explanation": "" },
    "communication":     { "score": 0, "explanation": "" },
    "romance":           { "score": 0, "explanation": "" },
    "marriageStability": { "score": 0, "explanation": "" },
    "familyValues":      { "score": 0, "explanation": "" },
    "financial":         { "score": 0, "explanation": "" },
    "personality":       { "score": 0, "explanation": "" }
  },
  "matchStrengths": [],
  "areasForUnderstanding": [],
  "aiMatchSummary": "",
  "sideByComparison": {
    "personOne": { "name": "", "rasi": "", "nakshatra": "", "lagna": "", "gunaScore": 0, "manglikStatus": "", "doshas": [], "compatibilityScore": 0 },
    "personTwo": { "name": "", "rasi": "", "nakshatra": "", "lagna": "", "gunaScore": 0, "manglikStatus": "", "doshas": [], "compatibilityScore": 0 }
  },
  "advancedAstrologyDetails": {
    "planetPositions": {
      "sun":     { "personOne": "", "personTwo": "" },
      "moon":    { "personOne": "", "personTwo": "" },
      "mars":    { "personOne": "", "personTwo": "" },
      "mercury": { "personOne": "", "personTwo": "" },
      "jupiter": { "personOne": "", "personTwo": "" },
      "venus":   { "personOne": "", "personTwo": "" },
      "saturn":  { "personOne": "", "personTwo": "" },
      "rahu":    { "personOne": "", "personTwo": "" },
      "ketu":    { "personOne": "", "personTwo": "" }
    },
    "housePlacements":  { "personOne": {}, "personTwo": {} },
    "navamsaAnalysis":  { "personOne": "", "personTwo": "" },
    "nakshatraAnalysis":{ "personOne": "", "personTwo": "" },
    "rasiAnalysis":     { "personOne": "", "personTwo": "" }
  },
  "finalRecommendation": { "category": "", "justification": "" }
}`;

    const response = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 8192,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    try {
      let content = text
        .replace(/^```json\s*/i, '')
        .replace(/```$/i, '')
        .trim();      
      return JSON.parse(content);
    } catch {
      return { raw: text };
    }
  }


  async getMatchById(id: string) {
    const match = await this.matchRepo.findOne({
      where: { id },
      relations: ['matchedUser', 'matchedUser.profile', 'matchedUser.profile.photos'],
    });
    if (!match) throw new NotFoundException('Match not found');
    return this.formatMatch(match);
  }

  async updateStatus(id: string, status: string, domain: string) {
    const match = await this.matchRepo.findOne({ where: { id } });
    if (!match) throw new NotFoundException('Match not found');

    match.status = status;
    if (status === 'shortlisted') match.currentStep = Math.max(match.currentStep, 1);
    if (status === 'interested') match.currentStep = Math.max(match.currentStep, 2);
    if (status === 'connected') match.currentStep = 3;

    const response = await this.matchRepo.save(match);

    const interest = await this.interestRepo.findOne({
      where: [
        { fromUserId: response.userId, toUserId: response.matchedUserId },
        { fromUserId: response.matchedUserId, toUserId: response.userId }]
    });
    
    if(!interest){
      const newInterest =  this.interestRepo.create({
        fromUserId: response.userId, 
        toUserId: response.matchedUserId,
        message: 'I would love to connect and get to know you better. Looking forward to hearing from you!'
      });
      //this.interestRepo.save(newInterest);
      await this.interestService.send(response.userId, response.matchedUserId, 'I would love to connect and get to know you better. Looking forward to hearing from you!', domain);
    }

    return response;
  }

  private computeCompatibility(userProfile: Profile, candidate: Profile) {
    const breakdown = {
      lifestyle: this.randomScore(60, 98),
      education: this.scoreEducation(userProfile, candidate),
      location: this.scoreLocation(userProfile, candidate),
      familyValues: this.scoreFamilyValues(userProfile, candidate),
      interests: this.randomScore(55, 95),
      career: this.randomScore(60, 95),
      emotional: this.randomScore(65, 98),
    };

    const weights = { lifestyle: 0.15, education: 0.15, location: 0.1, familyValues: 0.2, interests: 0.15, career: 0.1, emotional: 0.15 };
    const total = Math.round(
      Object.entries(breakdown).reduce((sum, [key, val]) => sum + val * (weights[key as keyof typeof weights] || 0.1), 0),
    );

    const badges = this.generateBadges(breakdown);
    const explanation = this.generateExplanation(total, breakdown, candidate);

    return { total, breakdown, badges, explanation };
  }

  private scoreEducation(a: Profile, b: Profile): number {
    return a.educationLevel === b.educationLevel ? this.randomScore(80, 98) : this.randomScore(50, 80);
  }

  private scoreLocation(a: Profile, b: Profile): number {
    if (a.city === b.city) return this.randomScore(85, 98);
    if (a.state === b.state) return this.randomScore(65, 85);
    return this.randomScore(40, 65);
  }

  private scoreFamilyValues(a: Profile, b: Profile): number {
    return a.familyType === b.familyType ? this.randomScore(75, 98) : this.randomScore(50, 75);
  }

  private randomScore(min: number, max: number): number {
    return Math.round(min + Math.random() * (max - min));
  }

  private generateBadges(breakdown: Record<string, number>) {
    const badges: { label: string; icon: string; score: number }[] = [];
    if (breakdown.familyValues >= 80) badges.push({ label: 'Family Aligned', icon: 'family_restroom', score: breakdown.familyValues });
    if (breakdown.education >= 80) badges.push({ label: 'Edu Match', icon: 'school', score: breakdown.education });
    if (breakdown.location >= 80) badges.push({ label: 'Nearby', icon: 'location_on', score: breakdown.location });
    if (breakdown.emotional >= 85) badges.push({ label: 'Soul Connect', icon: 'psychology', score: breakdown.emotional });
    if (breakdown.lifestyle >= 85) badges.push({ label: 'Lifestyle Sync', icon: 'spa', score: breakdown.lifestyle });
    return badges;
  }

  private generateExplanation(total: number, breakdown: Record<string, number>, candidate: Profile): string {
    const best = Object.entries(breakdown).sort(([, a], [, b]) => b - a)[0];
    const labels: Record<string, string> = {
      lifestyle: 'lifestyle compatibility', education: 'educational alignment',
      location: 'geographic proximity', familyValues: 'family values match',
      interests: 'shared interests', career: 'career compatibility', emotional: 'emotional resonance',
    };
    return `${total}% overall match with ${candidate.firstName}. Strong ${labels[best[0]] || best[0]} at ${best[1]}%.`;
  }

  /* 
  Hybrid formatting approach: for lists of matches, we use formatMatches to include profile summaries. For single match retrieval, we use formatMatch to provide detailed profile info. This optimizes performance while ensuring rich data where needed.
  */


  async enrichWithAI(
    userProfile: Profile,
    candidate: Profile,
    baseScores: { total: number; breakdown: Record<string, number> }
  ): Promise<{ explanation: string; badges: Badge[] }> {
    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-haiku-4-5',   // ← use Haiku: 10x cheaper, fast enough
        max_tokens: 200,
        messages: [{
          role: 'user',
          content: `
  Matrimony match scored ${baseScores.total}%.
  Person A: ${userProfile.age}yr ${userProfile.religion}, 
    ${userProfile.educationLevel}, ${userProfile.educationField}, ${userProfile.workingStatus}, ${userProfile.city}.
  Person B: ${candidate.age}yr ${candidate.religion}, 
    ${candidate.educationLevel}, ${candidate.educationField}, ${candidate.workingStatus}, ${candidate.city}.
  Scores: ${JSON.stringify(baseScores.breakdown)}.
  
  Return ONLY JSON:
  {
    "explanation": "<one warm, specific sentence about why they match>",
    "badges": [{"label":"...", "icon":"...",  "score": number}]  // max 3 badges
  }
    
  make sure you add the close tags like }, ] whereever it is required to make the putput as json format.`,
        }],
      });

      const text = response.content[0].type === 'text' ? response.content[0].text : '';
      let content = text
        .replace(/^```json\s*/i, '')
        .replace(/```$/i, '')
        .trim();
      console.log('AI enrichment response:', content);
      return JSON.parse(content);
    } catch (error) {
      // AI failure must never break matching
      console.error('AI enrichment failed:', error);
      return {
        explanation: `${baseScores.total}% compatibility based on shared values and background.`,
        badges: generateBadges(baseScores.breakdown),
      };
    }
  }



  //End of hybrid formatting approach



  private formatMatches(matches: Match[], interestStatusMap?: Map<string, string>) {
    return matches.map((m) => this.formatMatch(m, interestStatusMap?.get(m.matchedUserId)));
  }

  private formatMatch(match: Match, interestStatus?: string) {
    const profile = match.matchedUser?.profile;
    return {
      user: match.matchedUser,
      id: match.id,
      matchPercentage: match.matchPercentage,
      compatibilityBreakdown: match.compatibilityBreakdown,
      explanationText: match.explanationText,
      badges: match.badges,
      status: match.status,
      interestStatus: interestStatus ?? null,
      currentStep: match.currentStep,
      suggestedAt: match.suggestedAt,
      matchedUserId: match.matchedUserId,
      userId: match.userId,
      profile: profile ? {
        userId: profile.id,
        firstName: profile.firstName,
        lastName: profile.lastName,
        age: profile.age,
        gender: profile.gender,
        religion: profile.religion,
        motherTongue: profile.motherTongue,
        height: profile.height,
        aboutMe: profile.aboutMe,
        location: { city: profile.city, state: profile.state, country: profile.country, willingToRelocate: profile.willingToRelocate },
        education: { level: profile.educationLevel, field: profile.educationField, institution: profile.institution },
        occupation: { title: profile.occupationTitle, company: profile.company, annualIncome: profile.annualIncome, workingStatus: profile.workingStatus },
        familyDetails: { familyType: profile.familyType, fatherOccupation: profile.fatherOccupation, motherOccupation: profile.motherOccupation, siblings: profile.siblings, familyValues: profile.familyValues },
        photos: (profile.photos || []).map((ph) => ({ id: ph.id, url: ph.url, isPrimary: ph.isPrimary, isVerified: ph.isVerified })),
      } : null,
    };
  }
}
