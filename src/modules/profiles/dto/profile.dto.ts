import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString, IsOptional, IsNumber, IsEnum, IsBoolean,
  IsArray, Min, Max, ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class LocationDto {
  @ApiPropertyOptional({ example: 'Helotes' })
  @IsOptional() @IsString()
  city?: string;

  @ApiPropertyOptional({ example: 'TX' })
  @IsOptional() @IsString()
  state?: string;

  @ApiPropertyOptional({ example: 'India' })
  @IsOptional() @IsString()
  country?: string;

  @ApiPropertyOptional({ example: false })
  @IsOptional() @IsBoolean()
  willingToRelocate?: boolean;
}

export class EducationDto {
  @ApiPropertyOptional({ example: "Master's" })
  @IsOptional() @IsString()
  level?: string;

  @ApiPropertyOptional({ example: 'Computer Science' })
  @IsOptional() @IsString()
  field?: string;

  @ApiPropertyOptional({ example: 'IIT Delhi' })
  @IsOptional() @IsString()
  institution?: string;
}

export class OccupationDto {
  @ApiPropertyOptional({ example: 'Lawyer' })
  @IsOptional() @IsString()
  title?: string;

  @ApiPropertyOptional({ example: 'Google' })
  @IsOptional() @IsString()
  company?: string;

  @ApiPropertyOptional({ example: '15-20 LPA' })
  @IsOptional() @IsString()
  annualIncome?: string;

  @ApiPropertyOptional({ example: 'Employed' })
  @IsOptional() @IsString()
  workingStatus?: string;
}

export class FamilyDetailsDto {
  @ApiPropertyOptional({ enum: ['joint', 'nuclear'], example: 'nuclear' })
  @IsOptional() @IsEnum(['joint', 'nuclear'])
  familyType?: string;

  @ApiPropertyOptional({ example: 'Retired' })
  @IsOptional() @IsString()
  fatherOccupation?: string;
  
  @ApiPropertyOptional({ example: 'Retired' })
  @IsOptional() @IsString()
  motherOccupation?: string;
  
  @ApiPropertyOptional({ example: '2' })
  @IsOptional() @IsNumber()
  siblings?: number;
  
  @ApiPropertyOptional({ example: 'Traditional' })
  @IsOptional() @IsString()
  familyValues?: string;
  
  @ApiPropertyOptional({ example: 'Looking for someone with similar values' })
  @IsOptional() @IsString()
  familyPreferenceNote?: string;
}

export class AgeRangeDto {
  @ApiPropertyOptional({ example: 21 })
  @IsOptional() @IsNumber()
  min?: number;

  @ApiPropertyOptional({ example: 35 })
  @IsOptional() @IsNumber()
  max?: number;
}

export class PreferencesDto {
  @ApiPropertyOptional({ type: AgeRangeDto })
  @IsOptional() @ValidateNested()
  @Type(() => AgeRangeDto)
  ageRange?: AgeRangeDto;

  @ApiPropertyOptional({ example: ['Christian'] })
  @IsOptional() @IsArray() @IsString({ each: true })
  religions?: string[];

  @ApiPropertyOptional({ example: ["Master's"] })
  @IsOptional() @IsArray() @IsString({ each: true })
  education?: string[];

  @ApiPropertyOptional({ example: ['Engineer'] })
  @IsOptional() @IsArray() @IsString({ each: true })
  occupations?: string[];
  
}

export class HoroscopeDto {
  @ApiPropertyOptional({ example: '1990-01-01T05:00:00.000Z' })
  @IsOptional() @IsString()
  timeOfBirth?: string;

  @ApiPropertyOptional({ example: 'Mumbai' })
  @IsOptional() @IsString()
  placeOfBirth?: string;

  @ApiPropertyOptional({ example: 'Makar' })
  @IsOptional() @IsString()
  rashi?: string;

  @ApiPropertyOptional({ example: 'Ashwini' })
  @IsOptional() @IsString()
  nakshatra?: string;

  @ApiPropertyOptional({ example: 'No' })
  @IsOptional() @IsString()
  manglikStatus?: string;

  @ApiPropertyOptional({ example: 'https://storage.googleapis.com/bucket/horoscope.pdf' })
  @IsOptional() @IsString()
  documentUrl?: string;
}

export class UpdateProfileDto {
  @ApiPropertyOptional({ example: '0dc806a8-395d-4149-9830-55e869633490' })
  @IsOptional() @IsString()
  userId?: string;

  @ApiPropertyOptional({ example: 'Ananya' })
  @IsOptional() @IsString()
  firstName?: string;

  @ApiPropertyOptional({ example: 'Sharma' })
  @IsOptional() @IsString()
  lastName?: string;

  @ApiPropertyOptional({ example: 25 })
  @IsOptional() @IsNumber() @Min(18) @Max(100)
  age?: number;

  @ApiPropertyOptional({ example: '2001-05-01T05:00:00.000Z' })
  @IsOptional() @IsString()
  dateOfBirth?: string;

  @ApiPropertyOptional({ enum: ['bride', 'groom'], example: 'bride' })
  @IsOptional() @IsEnum(['bride', 'groom'])
  gender?: string;

  @ApiPropertyOptional({ example: 'Muslim' })
  @IsOptional() @IsString()
  religion?: string;

  @ApiPropertyOptional({ example: 'Brahmin' })
  @IsOptional() @IsString()
  caste?: string;

  @ApiPropertyOptional({ example: 'Hindi' })
  @IsOptional() @IsString()
  motherTongue?: string;

  @ApiPropertyOptional({ type: LocationDto })
  @IsOptional() @ValidateNested()
  @Type(() => LocationDto)
  location?: LocationDto;

  @ApiPropertyOptional({ type: EducationDto })
  @IsOptional() @ValidateNested()
  @Type(() => EducationDto)
  education?: EducationDto;

  @ApiPropertyOptional({ type: OccupationDto })
  @IsOptional() @ValidateNested()
  @Type(() => OccupationDto)
  occupation?: OccupationDto;

  @ApiPropertyOptional({ example: "5'1\"" })
  @IsOptional() @IsString()
  height?: string;

  @ApiPropertyOptional({ example: "50" })
  @IsOptional() @IsString()
  weight?: string;

  @ApiPropertyOptional({ example: 'A passionate individual who loves traveling.' })
  @IsOptional() @IsString()
  aboutMe?: string;

  @ApiPropertyOptional({ example: [] })
  @IsOptional() @IsArray()
  photos?: any[];

  @ApiPropertyOptional({ type: FamilyDetailsDto })
  @IsOptional() @ValidateNested()
  @Type(() => FamilyDetailsDto)
  familyDetails?: FamilyDetailsDto;

  @ApiPropertyOptional({ type: PreferencesDto })
  @IsOptional() @ValidateNested()
  @Type(() => PreferencesDto)
  preferences?: PreferencesDto;

  @ApiPropertyOptional({ enum: ['everyone', 'mutual_matches', 'premium_only', 'on_request'] })
  @IsOptional() @IsEnum(['everyone', 'mutual_matches', 'premium_only', 'on_request'])
  photoPrivacy?: string;

  @ApiPropertyOptional({ example: 'active' })
  @IsOptional() @IsString()
  status?: string;

  @ApiPropertyOptional({ example: 75 })
  @IsOptional() @IsNumber() @Min(0) @Max(100)
  profileCompleteness?: number;

  @ApiPropertyOptional({ example: 'https://example.com/video-intro.mp4' })
  @IsOptional() @IsString()
  videoIntroUrl?: string;

  @ApiPropertyOptional({ type: HoroscopeDto })
  @IsOptional() @ValidateNested()
  @Type(() => HoroscopeDto)
  horoscope: HoroscopeDto;

}

export class SearchProfilesDto {
  @ApiPropertyOptional({ example: 'Ananya' })
  @IsOptional() @IsString()
  query?: string;

  @ApiPropertyOptional({ enum: ['bride', 'groom'] })
  @IsOptional() @IsEnum(['bride', 'groom'])
  gender?: string;

  @ApiPropertyOptional({ example: 21 })
  @IsOptional() @IsNumber() @Type(() => Number)
  ageMin?: number;

  @ApiPropertyOptional({ example: 30 })
  @IsOptional() @IsNumber() @Type(() => Number)
  ageMax?: number;

  @ApiPropertyOptional({ example: 'Hindu' })
  @IsOptional() @IsString()
  religion?: string;

  @ApiPropertyOptional({ example: 'Mumbai' })
  @IsOptional() @IsString()
  city?: string;

  @ApiPropertyOptional({ example: "Master's" })
  @IsOptional() @IsString()
  educationLevel?: string;

  @ApiPropertyOptional({ example: 'active' })
  @IsOptional() @IsString()
  status?: string;

  @ApiPropertyOptional({ example: 1, description: 'Page number' })
  @IsOptional() @IsNumber() @Type(() => Number) @Min(1)
  page?: number;

  @ApiPropertyOptional({ example: 12, description: 'Items per page' })
  @IsOptional() @IsNumber() @Type(() => Number) @Min(1) @Max(50)
  limit?: number;
}

export class ProfileResponseDto {
  @ApiProperty()
  userId: string;

  @ApiProperty()
  firstName: string;

  @ApiProperty()
  lastName: string;

  @ApiProperty()
  age: number;

  @ApiProperty()
  gender: string;

  @ApiProperty()
  religion: string;

  @ApiProperty()
  location: { city: string; state: string; country: string; willingToRelocate: boolean };

  @ApiProperty()
  education: { level: string; field: string; institution?: string };

  @ApiProperty()
  occupation: { title: string; company?: string; annualIncome?: string; workingStatus: string };

  @ApiProperty()
  photos: { id: string; url: string; isPrimary: boolean; isVerified: boolean }[];
}
