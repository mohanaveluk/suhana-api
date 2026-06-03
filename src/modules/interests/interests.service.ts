import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Interest } from './entity/interest.entity';
import { Match } from '../user/entity';
import { match } from 'assert/strict';

@Injectable()
export class InterestsService {
  constructor(
    @InjectRepository(Interest) private readonly interestRepo: Repository<Interest>,
    @InjectRepository(Match) private readonly matchRepo: Repository<Match>,
  ) {}

  async getReceived(userId: string) {
    let interests = await this.interestRepo.find({
      where: { toUserId: userId },
      relations: ['fromUser', 'fromUser.profile', 'fromUser.profile.photos'],
      order: { createdAt: 'DESC' },
    });

    return this.formatInterests(interests);
  }

  async getSent(userId: string) {
    let interests = await this.interestRepo.find({
      where: { fromUserId: userId },
      relations: ['toUser', 'toUser.profile', 'toUser.profile.photos'],
      order: { createdAt: 'DESC' },
      });

    return interests;
  }

  async getSent1(userId: string) {
    let interests = await this.interestRepo.find({
      where: { fromUserId: userId },
      relations: ['toUser', 'toUser.profile', 'toUser.profile.photos'],
      order: { createdAt: 'DESC' },
    });
    return this.formatInterests(interests);
  }

  async send(fromUserId: string, toUserId: string, message?: string) {
    if (fromUserId === toUserId) {
      throw new BadRequestException('Cannot send interest to yourself');
    }
    const existing = await this.interestRepo.findOne({
      where: { fromUserId, toUserId },
    });
    if (existing) {
      throw new BadRequestException('Interest already sent to this user');
    }

    const match = await this.matchRepo.findOne({
      where: [
        { userId: fromUserId, matchedUserId: toUserId },
        { userId: toUserId, matchedUserId: fromUserId },
      ],
    });
    if (match) {
      match.status = 'interested';
      await this.matchRepo.save(match);
    }
    else{
      const newMatch = this.matchRepo.create({
        userId: fromUserId,
        matchedUserId: toUserId,
        matchPercentage: 0,
        status: 'interested',
        currentStep: 1,
      });
      await this.matchRepo.save(newMatch);
    }

    const interest = this.interestRepo.create({ fromUserId, toUserId, message });
    return this.interestRepo.save(interest);
  }

  async accept(interestId: string, userId: string) {
    const interest = await this.interestRepo.findOne({ where: { id: interestId } });
    if (!interest) throw new NotFoundException('Interest not found');
    if (interest.toUserId !== userId) throw new ForbiddenException('Cannot accept an interest not addressed to you');
    if (interest.status !== 'pending') throw new BadRequestException(`Interest is already ${interest.status}`);
    interest.status = 'accepted';
    const response =await this.interestRepo.save(interest);

    const match = await this.matchRepo.findOne({
      where: [
        { userId: response.fromUserId, matchedUserId: response.toUserId },
        { userId: response.toUserId, matchedUserId: response.fromUserId },
      ],
    });
    if (match) {
      match.status = 'connected';
      await this.matchRepo.save(match);
    }
    else{
      const newMatch = this.matchRepo.create({
        userId: response.fromUserId,
        matchedUserId: response.toUserId,
        matchPercentage: 0,
        status: 'connected',
        currentStep: 1,
      });
      await this.matchRepo.save(newMatch);
    }

    return response;
  }

  async decline(interestId: string, userId: string) {
    const interest = await this.interestRepo.findOne({ where: { id: interestId } });
    if (!interest) throw new NotFoundException('Interest not found');
    if (interest.toUserId !== userId) throw new ForbiddenException('Cannot decline an interest not addressed to you');
    if (interest.status !== 'pending') throw new BadRequestException(`Interest is already ${interest.status}`);
    interest.status = 'declined';
    return this.interestRepo.save(interest);
  }


  private formatInterests(interests: Interest[]) {
    return interests.map((i) => this.formatInterest(i));
  }

  private formatInterest(interest: Interest) {
    let profile = interest.fromUser?.profile || interest.toUser?.profile;
    const userId = interest.fromUser?.id || interest.toUser?.id;
    let user = {
      id: interest.fromUser?.id || interest.toUser?.id,
      userId : interest.fromUser?.id || interest.toUser?.id,
      profile: {...profile, userId: userId},

    }
    return {
      id: interest.id,
      message: interest.message,
      status: interest.status,
      createdAt: interest.createdAt,
      toUserId: interest.toUserId,
      fromUserId: interest.fromUserId,
      fromUser: user,
    };
  }

  private formatInterest1(interest: Interest) {
    const profile = interest.fromUser?.profile || interest.toUser?.profile;
    return {
      user: interest.fromUser || interest.toUser,
      id: interest.id,
      userId: interest.fromUser?.id || interest.toUser?.id,
      profile: profile ? {
        userId: profile.id,
        id: profile.id,
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
        horoscope: profile.horoscope,
        city: profile.city,
        state: profile.state,
        country: profile.country,
        preferences: profile.preferences,
        profileCode: profile.profileCode,

      } : null,
    };
  }

}
