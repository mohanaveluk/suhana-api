import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  UpdateDateColumn, OneToOne, OneToMany,
} from 'typeorm';
import { User } from './user.entity';
import { ProfilePhoto } from './profile-photo.entity';
import { ProfileStatus } from '../enums/profile-status.enum';

@Entity('profiles')
export class Profile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  firstName: string;

  @Column()
  lastName: string;

  @Column()
  age: number;

  @Column({ type: 'date', nullable: true })
  dateOfBirth: Date;

  @Column({ type: 'enum', enum: ['bride', 'groom'] })
  gender: string;

  @Column()
  religion: string;

  @Column({ nullable: true })
  caste: string;

  @Column()
  motherTongue: string;

  // Location
  @Column()
  city: string;

  @Column()
  state: string;

  @Column({ default: 'India' })
  country: string;

  @Column({ default: false })
  willingToRelocate: boolean;

  // Education
  @Column()
  educationLevel: string;

  @Column({ nullable: true })
  educationField: string;

  @Column({ nullable: true })
  institution: string;

  // Occupation
  @Column()
  occupationTitle: string;

  @Column({ nullable: true })
  company: string;

  @Column({ nullable: true })
  annualIncome: string;

  @Column({ default: 'Employed' })
  workingStatus: string;

  @Column({ nullable: true })
  height: string;

  @Column({ nullable: true })
  weight: string;

  @Column({ nullable: true })
  complexion: string;

  @Column({ type: 'text', nullable: true })
  aboutMe: string;

  // Family Details
  @Column({ type: 'enum', enum: ['joint', 'nuclear'], default: 'nuclear' })
  familyType: string;

  @Column({ nullable: true })
  fatherOccupation: string;

  @Column({ nullable: true })
  motherOccupation: string;

  @Column({ nullable: true })
  siblings: number;

  @Column({ nullable: true })
  familyValues: string;

  @Column({ nullable: true })
  familyPreferenceNote: string;

  @Column({ type: 'simple-array', nullable: true }) //['travel', 'cooking', 'music']
  interests: string[]; // Stored as JSON array

  @Column({ type: 'simple-array', nullable: true }) // ['non-smoker', 'vegetarian', 'early riser']
  lifestyleHabits: string[];

  @Column({ nullable: true }) // 'introvert' | 'extrovert' | 'ambivert'
  personalityType: string

  @Column({ type: 'simple-array', nullable: true }) // ['supportive', 'career-oriented', 'family-focused']
  partnerExpectations: string[]

  // Preferences (stored as JSON)
  @Column({ type: 'json', nullable: true })
  preferences: {
    ageRange?: { min: number; max: number };
    heightRange?: { min: string; max: string };
    religions?: string[];
    castes?: string[];
    education?: string[];
    occupations?: string[];
    locations?: string[];
    foodPreference?: string;
    familyType?: string;
  };

  // Horoscope (stored as JSON)
  @Column({ type: 'json', nullable: true })
  horoscope: {
    timeOfBirth?: string;
    placeOfBirth?: string;
    rashi?: string;
    nakshatra?: string;
    manglikStatus?: string;
    documentUrl?: string;
  };

  @Column({ type: 'enum', enum: ['everyone', 'mutual_matches', 'premium_only', 'on_request'], default: 'everyone' })
  photoPrivacy: string;

  @Column({ type: 'enum', enum: ['active', 'inactive', 'pending', 'reported', 'blocked'], default: 'active' })
  status: string;

  @Column({ default: 0 })
  profileCompleteness: number;

  @Column({ nullable: true })
  videoIntroUrl: string;

  @Column({ nullable: true })
  horoscopeDocUrl: string;

  @Column({ default: '', name: 'profile_code', unique: true, nullable: false, length: 9 })
  profileCode: string;

  @OneToOne(() => User, (user) => user.profile)
  user: User;

  @OneToMany(() => ProfilePhoto, (photo) => photo.profile, { cascade: true, eager: true })
  photos: ProfilePhoto[];

  // Match-fixed visibility controls
  @Column({
    type: 'enum',
    enum: ProfileStatus,
    default: ProfileStatus.ACTIVE,
    name: 'profile_status',
  })
  profileStatus: ProfileStatus;

  @Column({ default: true, name: 'is_searchable' })
  isSearchable: boolean;

  @Column({ default: true, name: 'accept_new_interest' })
  acceptNewInterest: boolean;

  @Column({ default: true, name: 'accept_new_chat' })
  acceptNewChat: boolean;

  @Column({ default: true, name: 'show_in_featured' })
  showInFeatured: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
