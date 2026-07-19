import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';

import { UpdateProfileDto, SearchProfilesDto } from './dto/profile.dto';
import { Profile, ProfilePhoto, User } from '../user/entity';
import { CloudStorageService } from 'src/common/services/cloud-storage.service';
import { url } from 'inspector/promises';
import { LookupService } from '../lookup/lookup.service';
import { CustomLoggerService } from '../logger/custom-logger.service';
import { EmailService } from 'src/shared/email/email.service';
import { shareProfileEmailTemplate, verifyEmailTemplate } from 'src/shared/email/templates/verify-email-template';
import { ShareProfileDto } from './dto/share-profile.dto';
import { EmailType } from '../email-history/entity/email-history.entity';


@Injectable()
export class ProfilesService {
  constructor(
    @InjectRepository(Profile) private readonly profileRepo: Repository<Profile>,
    @InjectRepository(ProfilePhoto) private readonly photoRepo: Repository<ProfilePhoto>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    private cloudStorageService: CloudStorageService,
    private lookupService: LookupService,
    private emailService: EmailService,
    private logger: CustomLoggerService
  ) {}

  async findAll(search: SearchProfilesDto) {
    const page = search.page || 1;
    const limit = search.limit || 20;
    const skip = (page - 1) * limit;

    const qb = this.profileRepo.createQueryBuilder('p')
      .leftJoinAndSelect('p.photos', 'photos')
      .leftJoinAndSelect('p.user', 'u')
    //.where('p.status = :status', { status: 'active' });

    // Status filter
    const queryStatus = search.status?.trim() || 'active';

    if (queryStatus === 'all') {
      qb.where('1 = 1');
    } else {
      qb.where('p.status = :status', { status: queryStatus })
        .andWhere('u.is_active = :isActive', { isActive: 1, })
        .andWhere('p.is_searchable = :isSearchable', { isSearchable: 1 })
        //.andWhere('photos.isActive = :isActive', { isActive: 1 });
    }      

    if (search.gender) qb.andWhere('p.gender = :gender', { gender: search.gender });
    if (search.religion) {
      const religions = search.religion.split(',').map((r) => r.trim()).filter(Boolean);
      qb.andWhere('p.religion IN (:...religions)', { religions });
    }
    if (search.city){
      const locations = search.city.split(',').map((r) => r.trim()).filter(Boolean);
      qb.andWhere('p.city IN (:...locations)', { locations });
    }
    if (search.educationLevel){
      const educationLevels = search.educationLevel.split(',').map((r) => r.trim()).filter(Boolean);
      qb.andWhere('p.educationLevel IN (:...educationLevels)', { educationLevels });
    }
    if (search.occupation){
      const occupations = search.occupation.split(',').map((r) => r.trim()).filter(Boolean);
      qb.andWhere('p.occupationTitle IN (:...occupations)', { occupations });
    }        
    if (search.ageMin) qb.andWhere('p.age >= :ageMin', { ageMin: search.ageMin });
    if (search.ageMax) qb.andWhere('p.age <= :ageMax', { ageMax: search.ageMax });
    if (search.query) {
      qb.andWhere('(p.firstName LIKE :q OR p.lastName LIKE :q OR p.city LIKE :q OR p.occupationTitle LIKE :q OR p.educationLevel LIKE :q OR p.religion LIKE :q OR p.gender LIKE :q)', {
        q: `%${search.query}%`,
      });
    }
    qb.addOrderBy('p.createdAt', 'DESC')
    qb.addOrderBy('photos.isPrimary', 'DESC')

    const [data, total] = await qb.skip(skip).take(limit).getManyAndCount();

    data.forEach(profile => {
      if (profile.photos?.length > 0) {
        profile.photos = profile.photos.filter(
          photo => photo.isActive === 1
        );
      }
    });    

    return {
      data: data.map((p) => this.toProfileResponse(p)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }



  async findById(id: string) {
    const profile = await this.profileRepo.findOne({
      where: { id, user: {is_active: 1} },
      relations: ['photos', 'user'],
    });
    if (!profile) throw new NotFoundException('Profile not found');

    if (profile?.photos?.length) {
      profile.photos = profile.photos.filter(photo => photo.isActive = 1);
      profile.photos.sort(
        (a, b) => Number(b.isPrimary) - Number(a.isPrimary)
      );
    }
    return this.toProfileResponse(profile);
  }

  async findByCode(id: string) {
    const profile = await this.profileRepo.findOne({
      where: { profileCode: id , user: {is_active: 1} },
      relations: ['photos', 'user'],
    });
    if (!profile) throw new NotFoundException('Profile not found');
    if (profile?.photos?.length) {
      profile.photos = profile.photos.filter(photo => photo.isActive = 1);
      profile.photos.sort(
        (a, b) => Number(b.isPrimary) - Number(a.isPrimary)
      );
    }
    return this.toProfileResponse(profile);
  }

  async findByUserId(userId: string) {
    const user = await this.userRepo.findOne({
      where: { id: userId, is_active: 1 },
      relations: ['profile', 'profile.photos'],
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!user?.profile) throw new NotFoundException('Profile not found');
    if (user?.profile?.photos?.length) {
      user.profile.photos = user.profile.photos.filter(
        photo => photo.isActive === 1,
      );      
      user.profile.photos.sort(
        (a, b) => Number(b.isPrimary) - Number(a.isPrimary)
      );
    }
    return this.toUserProfileResponse(user);
  }

  async findByEmailId(email: string) {
    const user = await this.userRepo.findOne({
      where: { email: email, is_active: 1 },
      relations: ['profile', 'profile.photos'],
    });
    if (!user?.profile) throw new NotFoundException('Profile not found');
    
    if (user?.profile?.photos?.length) {
      user.profile.photos = user.profile.photos.filter(
        photo => photo.isActive === 1,
      );         
      user.profile.photos.sort(
        (a, b) => Number(b.isPrimary) - Number(a.isPrimary)
      );
    }
    return this.toUserProfileResponse(user);
  }

  async updateNew(domain: string, dto: UpdateProfileDto) {
    console.log(JSON.stringify(dto));
    this.logger.debug(`Updating new user information ${dto.userId}`);
    const user = await this.userRepo.findOne({
      where: {id: dto.userId, is_email_verified: false, temp_guid: dto.tempGuid}
    });
    if (!user) throw new NotFoundException('User not found');
    const response = await this.update(user.id, domain, dto);
    return response;
  }

  async update(userId: string, domain: string, dto: UpdateProfileDto) {
    try {
      const user = await this.userRepo.findOne({
        where: { id: userId, temp_guid: dto.tempGuid},
        relations: ['profile', 'profile.photos'],
      });
      if (!user?.profile) throw new NotFoundException('Profile not found');

      // Photos are managed via dedicated endpoints (uploadProfileImage/addPhoto/deletePhoto).
      // Never let the profile update touch the eagerly-loaded `photos` collection: because the
      // relation is { cascade: true }, overwriting it with the DTO's (often empty) `photos`
      // makes TypeORM treat the existing rows as orphans and nullify their `profileId`.
      const { photos, ...profileData } = dto as any;
      Object.assign(user.profile, profileData);
      user.profile.firstName = user.first_name = dto.firstName || user.profile.firstName;
      user.profile.lastName = user.last_name = dto.lastName || user.profile.lastName;
      user.profile.age = dto.age || user.profile.age;
      user.profile.dateOfBirth = dto.dateOfBirth ? new Date(dto.dateOfBirth) : user.profile.dateOfBirth;
      user.profile.educationField = dto.education?.field || user.profile.educationField;
      user.profile.educationLevel = dto.education?.level || user.profile.educationLevel;
      user.profile.institution = dto.education?.institution || user.profile.institution;
      user.profile.occupationTitle = dto.occupation?.title || user.profile.occupationTitle;
      user.profile.company = dto.occupation?.company || user.profile.company;
      user.profile.annualIncome = dto.occupation?.annualIncome || user.profile.annualIncome;
      user.profile.workingStatus = dto.occupation?.workingStatus || user.profile.workingStatus;
      user.profile.city = dto.location?.city || user.profile.city;
      user.profile.state = dto.location?.state || user.profile.state;
      user.profile.country = dto.location?.country || user.profile.country;
      user.profile.willingToRelocate = dto.location?.willingToRelocate ?? user.profile.willingToRelocate;
      user.profile.height = dto.height || user.profile.height;
      user.profile.weight = dto.weight || user.profile.weight;
      user.profile.preferences.ageRange.min = dto.preferences?.ageRange?.min || user.profile.preferences.ageRange.min;
      user.profile.preferences.ageRange.max = dto.preferences?.ageRange?.max || user.profile.preferences.ageRange.max;
      user.profile.fatherOccupation = dto.familyDetails?.fatherOccupation || user.profile.fatherOccupation;
      user.profile.motherOccupation = dto.familyDetails?.motherOccupation || user.profile.motherOccupation;
      user.profile.siblings = dto.familyDetails?.siblings || user.profile.siblings;
      user.profile.familyValues = dto.familyDetails?.familyValues || user.profile.familyValues;
      user.profile.familyPreferenceNote = dto.familyDetails?.familyPreferenceNote || user.profile.familyPreferenceNote;

      user.profile.horoscope = {
        dateOfBirth: dto.horoscope?.dateOfBirth ? new Date(dto.horoscope.dateOfBirth) : user.profile.horoscope?.dateOfBirth,
        timeOfBirth: dto.horoscope?.timeOfBirth || user.profile.horoscope?.timeOfBirth,
        placeOfBirth: dto.horoscope?.placeOfBirth || user.profile.horoscope?.placeOfBirth,
        rashi: dto.horoscope?.rashi || user.profile.horoscope?.rashi,
        nakshatra: dto.horoscope?.nakshatra || user.profile.horoscope?.nakshatra,
        manglikStatus: dto.horoscope?.manglikStatus || user.profile.horoscope?.manglikStatus,
        documentUrl: dto.horoscope?.documentUrl || user.profile.horoscope?.documentUrl,
      };
      user.updated_at = user.verification_code_expiry = new Date();
      user.profile.horoscopeDocUrl = dto.horoscope?.documentUrl || user.profile.horoscopeDocUrl;
      // user.profile.photos.forEach((photo) => {
      //   const updatedPhoto = dto.photos?.find((p) => p.id === photo.id);
      //   if (updatedPhoto) {
      //     photo.profileId = user.profile.id;
      //   }
      // });
      user.profile.profileCompleteness = this.calculateCompleteness(user.profile);
      const userSaved = await this.userRepo.save(user);
      const saved = await this.profileRepo.save(user.profile);

      // Auto-capture unique city and occupation values for dropdown lookups
      await Promise.all([
        this.lookupService.upsertCity(saved.city),
        this.lookupService.upsertEducation(saved.educationLevel),
        this.lookupService.upsertOccupation(saved.occupationTitle),
      ]);

      // if dto.photos && dto.photos.length > 0, call the this.addPhoto for length of the photos array
      if (dto.photos && dto.photos.length > 0) {
        const existingPhoto = await this.photoRepo.find({ where: { profile: { id: user.profile.id } } });
        if (existingPhoto) {
          existingPhoto.forEach((photo) => {
            photo.isActive = 0;
          });
          await this.photoRepo.save(existingPhoto);
        }
        await Promise.all(dto.photos.map((photo) => this.addPhoto(userId, photo.url, photo.variants, photo.isPrimary)));
      }

      // if (dto.photos && dto.photos.length > 0) {
      //   await this.addPhoto(userId, dto.photos?.[0]?.url, dto.photos?.[0]?.variants, dto.photos?.[0]?.isPrimary);
      // }

      if (!userSaved.is_email_verified) {
        this.logger.debug(`Yet to verify email id: ${userSaved.email}`);
        //Send verification email
        this.logger.debug('Sending email...');
        const userFirstName = userSaved.first_name ? (userSaved.first_name === "" || userSaved.first_name === 'unknown' ? "User" : userSaved.first_name) : "User";

        await this.emailService.sendEmail({
          to: user.email,
          cc: 'gcpstudy0@gmail.com',
          subject: 'Suhana - Verify Your Email Address',
          html: verifyEmailTemplate(user.verification_code, user.id, userFirstName, domain),
          history: {
            emailType: EmailType.EMAIL_VERIFICATION,
            fromUserId: user.id,
            toUserId: user.id,
            createdBy: user.id
          }
        });
        this.logger.debug('Email has been sent');
      }

      return this.toProfileResponse(saved);
      
    } catch (err) {
      this.logger.debug(err as string);
      throw err;
    }
  }

  async addPhoto(userId: string, url: string, variants: any,  isPrimary = false) {
    const user = await this.userRepo.findOne({
      where: { id: userId },
      relations: ['profile'],
    });
    if (!user?.profile) throw new NotFoundException('Profile not found');

    // const existingPhoto = await this.photoRepo.findOne({ where: { profile: { id: user.profile.id } } });
    // //const existingPhoto = await this.photoRepo.findOne({ where: { url, profile: { id: user.profile.id } } });
    // if (existingPhoto) {
    //   // existingPhoto.url = url;
    //   // existingPhoto.variants = { ...existingPhoto.variants, originalUrl: url };
    //   // existingPhoto.isPrimary = isPrimary;
    //   existingPhoto.isActive = 0;
    //   await this.photoRepo.save(existingPhoto);
    // }
    
    const photo = this.photoRepo.create({ url, variants, isPrimary, profile: user.profile });
    return this.photoRepo.save(photo);
  }

  
  async uploadProfileImage(userGuid: string, file: Express.Multer.File, isPrimary = false): Promise<{ message: string; imageUrl: string, profileId: string }> {
    try {
      const user = await this.userRepo.findOne({
        where: { id: userGuid },
        relations: ['profile'],
      });

      if (!user) {
        if (!user?.profile) throw new NotFoundException('Profile not found');
      }

      //const imageUrl = await this.storageService.uploadFile(file);
      const folder = `matrimony/gallery/${user?.profile.id}`;
      const imageUrl = await this.cloudStorageService.uploadFile(file, folder);
      
      // const photo = this.photoRepo.create({ url: imageUrl, isPrimary, profile: user.profile });
      // await this.photoRepo.save(photo);

      return {
        message: 'Profile image uploaded successfully',
        imageUrl,
        profileId: user?.profile.id
      };
    } catch (error) {
      throw error;
    }
  }

  async uploadHoroscopeDocument(userId: string, file: Express.Multer.File): Promise<{ message: string; url: string }> {
    const user = await this.userRepo.findOne({
      where: { id: userId },
      relations: ['profile'],
    });
    if (!user?.profile) throw new NotFoundException('Profile not found');

    await this.cloudStorageService.isFileValid(file);

    const folder = `matrimony/horoscope/${user.profile.id}`;
    const url = await this.cloudStorageService.uploadFile(file, folder);

    return { message: 'Horoscope document uploaded successfully', url };
  }

  async shareProfile(userId: string, dto: ShareProfileDto, domain: string): Promise<{ message: string }> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const senderName = [user.first_name, user.last_name].filter(Boolean).join(' ') || 'A Suhana member';
    const subject = dto.subject ?? `${senderName} wants to share a profile with you on Suhana Matrimony`;
    const html = shareProfileEmailTemplate({
      senderName,
      receiverName: dto.receiverName,
      profileUrl: dto.shareUrl,
      subject: dto.subject,
      body: dto.body,
      domain,
    });

    await this.emailService.sendEmail({ to: dto.toEmail, subject, html });
    return { message: 'Profile shared successfully' };
  }

  async deletePhoto(userId: string, photoId: string) {
    const result = await this.photoRepo.delete(photoId);
    if (result.affected === 0) throw new NotFoundException('Photo not found');
    return { message: 'Photo deleted' };
  }

  private calculateCompleteness(profile: Profile): number {
    const fields = [
      profile.firstName, profile.lastName, profile.age, profile.religion,
      profile.motherTongue, profile.city, profile.state, profile.educationLevel,
      profile.occupationTitle, profile.height, profile.aboutMe,
      profile.familyType, profile.dateOfBirth,
    ];
    const filled = fields.filter((f) => f !== null && f !== undefined && f !== '' && f !== 0).length;
    return Math.round((filled / fields.length) * 100);
  }

  private toUserProfileResponse(user: User) {
    const userDetail = {
      id: user.id,
      email: user.email,
      mobile: user.mobile,
      gender: user.gender,
      membership: user.membership,
      isEmailVerified: user.is_email_verified,
      isVerified: user.is_verified,
      profileImage: user.profile_image,
      lastActive: user.last_active,
      createdAt: user.created_at,
      tempGuid: user.temp_guid,
      firstName: user.first_name,
      lastName: user.last_name,
    }
    return {
      ...this.toProfileResponse(user.profile),
      user: userDetail,
    };
  }

  private toProfileResponse(profile: Profile) {
    return {
      user: profile.user,
      userId: profile.id,
      firstName: profile.firstName,
      lastName: profile.lastName,
      age: profile.age,
      dateOfBirth: profile.dateOfBirth,
      gender: profile.gender,
      religion: profile.religion,
      caste: profile.caste,
      motherTongue: profile.motherTongue,
      height: profile.height,
      weight: profile.weight,
      complexion: profile.complexion,
      aboutMe: profile.aboutMe,
      photoPrivacy: profile.photoPrivacy,
      status: profile.status,
      profileCompleteness: profile.profileCompleteness,
      videoIntroUrl: profile.videoIntroUrl,
      profileCode: profile.profileCode,
      location: {
        city: profile.city,
        state: profile.state,
        country: profile.country,
        willingToRelocate: profile.willingToRelocate,
      },
      education: {
        level: profile.educationLevel,
        field: profile.educationField,
        institution: profile.institution,
      },
      occupation: {
        title: profile.occupationTitle,
        company: profile.company,
        annualIncome: profile.annualIncome,
        workingStatus: profile.workingStatus,
      },
      familyDetails: {
        familyType: profile.familyType,
        fatherOccupation: profile.fatherOccupation,
        motherOccupation: profile.motherOccupation,
        siblings: profile.siblings,
        familyValues: profile.familyValues,
        familyPreferenceNote: profile.familyPreferenceNote,
      },
      preferences: profile.preferences,
      horoscope: profile.horoscope,
      horoscopeDocUrl: profile.horoscopeDocUrl,
      photos: (profile.photos || []).map((ph) => ({
        id: ph.id,
        url: ph.url,
        variants: ph.variants,
        createdAt: ph.createdAt,
        isPrimary: ph.isPrimary,
        isVerified: ph.isVerified,
      })),
    };
  }
}
