import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Match } from '../user/entity';

@Injectable()
export class ShortlistService {
  constructor(
    @InjectRepository(Match) private readonly matchRepo: Repository<Match>,
  ) {}

  async getShortlisted(userId: string) {
    return this.matchRepo.find({
      where: { userId, status: 'shortlisted' },
      relations: ['matchedUser', 'matchedUser.profile', 'matchedUser.profile.photos'],
      order: { suggestedAt: 'DESC' },
    });
  }

  async getInterested(userId: string) {
    return this.matchRepo.find({
      where: { userId, status: 'interested' },
      relations: ['matchedUser', 'matchedUser.profile', 'matchedUser.profile.photos'],
      order: { suggestedAt: 'DESC' },
    });
  }

  async getConnected(userId: string) {
    return this.matchRepo.find({
      where: { userId, status: 'connected' },
      relations: ['matchedUser', 'matchedUser.profile', 'matchedUser.profile.photos'],
      order: { suggestedAt: 'DESC' },
    });
  }

  async shortlistUser(userId: string, matchedUserId: string) {
    const match = await this.matchRepo.findOne({
      where: { userId, matchedUserId },
      relations: ['matchedUser', 'matchedUser.profile', 'matchedUser.profile.photos'],
    });
    if (!match) {
      // If no existing match, create a new one with 'shortlisted' status
      const newMatch = this.matchRepo.create({
        userId: userId, // This should be set to the current user's ID in a real implementation
        matchedUserId: matchedUserId,
        matchPercentage: 0,
        status: 'shortlisted',
        currentStep: 1,
      });
      return this.matchRepo.save(newMatch);
    }
    match.status = 'shortlisted';
    match.currentStep = Math.max(match.currentStep, 1);
    return this.matchRepo.save(match);
  }

  async shortlist(matchId: string) {
    return this.updateMatchStatus(matchId, 'shortlisted');
  }

  async expressInterest(matchId: string) {
    return this.updateMatchStatus(matchId, 'interested');
  }

  async connect(matchId: string) {
    return this.updateMatchStatus(matchId, 'connected');
  }

  async skip(matchId: string) {
    return this.updateMatchStatus(matchId, 'skipped');
  }

  async reconsider(matchId: string) {
    return this.updateMatchStatus(matchId, 'reconsidered');
  }

  private async updateMatchStatus(matchId: string, status: string) {
    const match = await this.matchRepo.findOne({
      where: { id: matchId },
      relations: ['matchedUser', 'matchedUser.profile', 'matchedUser.profile.photos'],
    });
    if (!match) throw new NotFoundException('Match not found');

    match.status = status;
    if (status === 'shortlisted') match.currentStep = Math.max(match.currentStep, 1);
    if (status === 'interested') match.currentStep = Math.max(match.currentStep, 2);
    if (status === 'connected') match.currentStep = 3;

    return this.matchRepo.save(match);
  }
}
