import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Match, Profile, User } from '../user/entity';
import { Interest } from '../interests/entity/interest.entity';

@Injectable()
export class MatchesService {
  constructor(
    @InjectRepository(Match) private readonly matchRepo: Repository<Match>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(Profile) private readonly profileRepo: Repository<Profile>,
    @InjectRepository(Interest) private readonly interestRepo: Repository<Interest>,
  ) {}

  async generateMatches(userId: string, count = 4) {
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
      order: { matchPercentage: 'DESC' },
    });
    return this.formatMatches(matches);
  }

  async getMatcheByUsers(userId: string, matchedUserId: string) {
    const match = await this.matchRepo.findOne({
      where: { userId, matchedUserId },
      relations: ['matchedUser', 'matchedUser.profile', 'matchedUser.profile.photos'],
      order: { matchPercentage: 'DESC' },
    });
    return this.formatMatch(match);
  }


  async getMatchById(id: string) {
    const match = await this.matchRepo.findOne({
      where: { id },
      relations: ['matchedUser', 'matchedUser.profile', 'matchedUser.profile.photos'],
    });
    if (!match) throw new NotFoundException('Match not found');
    return this.formatMatch(match);
  }

  async updateStatus(id: string, status: string) {
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
      this.interestRepo.save(newInterest);
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

  private formatMatches(matches: Match[]) {
    return matches.map((m) => this.formatMatch(m));
  }

  private formatMatch(match: Match) {
    const profile = match.matchedUser?.profile;
    return {
      user: match.matchedUser,
      id: match.id,
      matchPercentage: match.matchPercentage,
      compatibilityBreakdown: match.compatibilityBreakdown,
      explanationText: match.explanationText,
      badges: match.badges,
      status: match.status,
      currentStep: match.currentStep,
      suggestedAt: match.suggestedAt,
      matchedUserId: match.matchedUserId,
      userId: match.matchedUserId,
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
