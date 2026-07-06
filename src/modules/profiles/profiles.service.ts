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
import { verifyEmailTemplate } from 'src/shared/email/templates/verify-email-template';


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
        .andWhere('p.is_searchable = :isSearchable', { isSearchable: 1 });
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
      qb.andWhere('(p.firstName LIKE :q OR p.lastName LIKE :q OR p.city LIKE :q OR p.occupationTitle LIKE :q OR p.educationLevel LIKE :q OR p.religion LIKE :q)', {
        q: `%${search.query}%`,
      });
    }
    qb.addOrderBy('photos.isPrimary', 'DESC')

    const [data, total] = await qb.skip(skip).take(limit).getManyAndCount();

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
      profile.photos.sort(
        (a, b) => Number(b.isPrimary) - Number(a.isPrimary)
      );
    }
    return this.toProfileResponse(profile);
  }

  async findByCode(id: string) {
    const profile = await this.profileRepo.findOne({
      where: { profileCode: id },
      relations: ['photos', 'user'],
    });
    if (!profile) throw new NotFoundException('Profile not found');
    if (profile?.photos?.length) {
      profile.photos.sort(
        (a, b) => Number(b.isPrimary) - Number(a.isPrimary)
      );
    }
    return this.toProfileResponse(profile);
  }

  async findByUserId(userId: string) {
    const user = await this.userRepo.findOne({
      where: { id: userId },
      relations: ['profile', 'profile.photos'],
    });

    if (!user?.profile) throw new NotFoundException('Profile not found');
    if (user?.profile?.photos?.length) {
      user.profile.photos.sort(
        (a, b) => Number(b.isPrimary) - Number(a.isPrimary)
      );
    }
    return this.toUserProfileResponse(user);
  }

  async findByEmailId(email: string) {
    const user = await this.userRepo.findOne({
      where: { email: email },
      relations: ['profile', 'profile.photos'],
    });
    if (!user?.profile) throw new NotFoundException('Profile not found');
    
    if (user?.profile?.photos?.length) {
      user.profile.photos.sort(
        (a, b) => Number(b.isPrimary) - Number(a.isPrimary)
      );
    }
    return this.toUserProfileResponse(user);
  }

  async updateNew(domain: string, dto: UpdateProfileDto) {
    console.log(JSON.stringify(dto));
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

      Object.assign(user.profile, dto);
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
      user.profile.horoscopeDocUrl = dto.horoscope?.documentUrl || user.profile.horoscopeDocUrl;

      user.profile.profileCompleteness = this.calculateCompleteness(user.profile);
      const userSaved = await this.userRepo.save(user);
      const saved = await this.profileRepo.save(user.profile);


      // if (!userSaved.is_email_verified) {
      //   //Send verification email
      //   this.logger.debug('Sending email...');
      //   const userFirstName = userSaved.first_name ? (userSaved.first_name === "" || userSaved.first_name === 'unknown' ? "User": userSaved.first_name) : "User";

      //   await this.emailService.sendEmail({
      //     to: user.email,
      //     cc: 'gcpstudy0@gmail.com',
      //     subject: 'Verify Your Email Address',
      //     html: verifyEmailTemplate(user.verification_code, user.id, userFirstName, domain),
      //   });
      //   this.logger.debug('Email has been sent');
      // }

      // Auto-capture unique city and occupation values for dropdown lookups
      await Promise.all([
        this.lookupService.upsertCity(saved.city),
        this.lookupService.upsertEducation(saved.educationLevel),
        this.lookupService.upsertOccupation(saved.occupationTitle),
      ]);

      if (dto.photos && dto.photos.length > 0) {
        await this.addPhoto(userId, dto.photos?.[0]?.url, dto.photos?.[0]?.isPrimary);
      }
      return this.toProfileResponse(saved);
      
    } catch (err) {
      this.logger.debug(err as string);
      throw err;
    }
  }

  async addPhoto(userId: string, url: string, isPrimary = false) {
    const user = await this.userRepo.findOne({
      where: { id: userId },
      relations: ['profile'],
    });
    if (!user?.profile) throw new NotFoundException('Profile not found');

    const existingPhoto = await this.photoRepo.findOne({ where: { url, profile: { id: user.profile.id } } });
    if (existingPhoto) {
      existingPhoto.isPrimary = isPrimary;
      return this.photoRepo.save(existingPhoto);
    }
    
    const photo = this.photoRepo.create({ url, isPrimary, profile: user.profile });
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
        isPrimary: ph.isPrimary,
        isVerified: ph.isVerified,
      })),
    };
  }
}
