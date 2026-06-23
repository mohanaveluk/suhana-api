import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Interest } from './entity/interest.entity';
import { Match, User } from '../user/entity';
import { match } from 'assert/strict';
import { EmailService } from 'src/shared/email/email.service';
import { CustomLoggerService } from '../logger/custom-logger.service';
import { EmailType } from '../email-history/entity/email-history.entity';
import { interestAcceptedEmailTemplate, interestRequestEmailTemplate } from 'src/shared/email/templates/verify-email-template';
import { v4 as uuidv4 } from 'uuid';
import { ChatService } from '../chat/chat.service';

@Injectable()
export class InterestsService {
  constructor(
    @InjectRepository(Interest) private readonly interestRepo: Repository<Interest>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(Match) private readonly matchRepo: Repository<Match>,
    private emailService: EmailService,
    private logger: CustomLoggerService,
    private chatService: ChatService
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

  async send(fromUserId: string, toUserId: string, message?: string, domain?: string) {
    if (fromUserId === toUserId) {
      throw new BadRequestException('Cannot send interest to yourself');
    }
    const existing = await this.interestRepo.findOne({
      where: { fromUserId, toUserId },
    });
    if (existing) {
      throw new BadRequestException('Interest already sent to this user');
    }

    const sender = await this.userRepo.findOne({
      where: {id: fromUserId, is_active: 1}
    });
    const recipient = await this.userRepo.findOne({
      where: {id: toUserId, is_active: 1}
    });

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

    let existing1 = null;
    const interestGuid = uuidv4();
    existing1 = await this.interestRepo.findOne({
      where: { fromUserId, toUserId },
    });
    if (existing1) {
      existing1.message = message;
    }
    else{
      existing1 = this.interestRepo.create({ fromUserId, toUserId, message, guid: interestGuid });
    }
    const interestResponse = await this.interestRepo.save(existing1);
    
    // Send verification email
    this.logger.debug('Sending email...');
    await this.emailService.sendEmail({
      to: recipient.email,
      cc: "gcpstudy0@gmail.com",
      subject: `${sender.first_name} is interested in your profile – Suhana Matrimony`,
      html: interestRequestEmailTemplate({
        recipientFirstName: recipient.first_name,
        senderFirstName: sender.first_name,
        senderProfileId: sender.profile.profileCode,
        senderAge: sender.profile.age,
        senderLocation: sender.profile.city,
        senderProfession: sender.profile.occupationTitle,
        senderPhotoUrl: sender.profile.photos[0].url ?? "https://storage.googleapis.com/inv-images/profile/userview.png",
        acceptUrl: `${domain}/accept/${interestResponse.id}/${interestGuid}`,
        viewProfileUrl: `${domain}/view/${sender.profile.profileCode}`,
        domain: domain
    }),
      history: {
        emailType: EmailType.INTEREST_SENT,
        fromUserId: sender.id,
        toUserId: recipient.id,
        createdBy: sender.id
      }
    });
    this.logger.debug('Email has been sent');

    return interestResponse;
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

  async findPendingInterest(interestId: string, guid: string) {
    return this.interestRepo.findOne({
      where: { id: interestId, guid },
      relations: ['fromUser', 'fromUser.profile'],
    });
  }

  async acceptViaLink(interestId: string, guid: string): Promise<{
    success: boolean;
    message: string;
    requesterName?: string;
    requesterUserId?: string;
  }> {
    const interest = await this.findPendingInterest(interestId, guid);

    if (!interest) {
      return { success: false, message: 'Invalid or expired link' };
    }

    if (interest.status === 'accepted') {
      return { success: false, message: 'Interest already accepted' };
    }

    if (interest.status !== 'pending') {
      return { success: false, message: 'Invalid or expired link' };
    }

    interest.status    = 'accepted';
    interest.acceptedOn = new Date();
    const saved = await this.interestRepo.save(interest);

    // Sync match status to 'connected'
    const match = await this.matchRepo.findOne({
      where: [
        { userId: saved.fromUserId, matchedUserId: saved.toUserId },
        { userId: saved.toUserId,   matchedUserId: saved.fromUserId },
      ],
    });
    if (match) {
      match.status = 'connected';
      await this.matchRepo.save(match);
    } else {
      await this.matchRepo.save(
        this.matchRepo.create({
          userId: saved.fromUserId,
          matchedUserId: saved.toUserId,
          matchPercentage: 0,
          status: 'connected',
          currentStep: 1,
        }),
      );
    }

    // Load acceptor (toUser) to personalise the notification email
    const acceptor = await this.userRepo.findOne({ 
      where: { id: saved.toUserId },
      relations: ['profile']
    });

    // Start conversation between acceptor and requester
    if (acceptor?.profile && interest.fromUser?.profile) {
      try {
        const seedMessage = `Hi ${interest.fromUser?.profile?.firstName ?? 'User'}, Thank you for showing interest in my profile! I'm delighted by your response and would love to share more information about myself and learn more about you too.`;
        await this.chatService.startConversationByProfiles(
          acceptor.id,
          interest.fromUser.id,
          seedMessage
        );
      } catch (chatErr) {
        this.logger.debug(`Failed to start conversation: ${(chatErr as any)?.message}`);
      }
    }

    // Notify the original requester (fromUser)
    const requester = interest.fromUser;
    if (requester?.email) {
      try {
        await this.emailService.sendEmail({
          to:      requester.email,
          subject: 'Your Interest request has been accepted',
          html:    interestAcceptedEmailTemplate({
            requesterFirstName: requester.first_name,
            acceptorFirstName:  acceptor?.first_name ?? 'Your match',
            loginUrl:           `${process.env.FRONTEND_URL}/chat`,
            domain:             process.env.FRONTEND_URL,
          }),
          history: {
            emailType: EmailType.INTEREST_ACCEPTED,
            fromUserId: saved.toUserId,
            toUserId:   saved.fromUserId,
            createdBy:  saved.toUserId,
          },
        });
      } catch (emailErr) {
        this.logger.debug(`Failed to send acceptance email: ${(emailErr as any)?.message}`);
      }
    }

    return {
      success:         true,
      message:         'Interest accepted successfully',
      requesterName:   `${requester?.first_name ?? ''} ${requester?.last_name ?? ''}`.trim(),
      requesterUserId: requester?.id,
    };
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
