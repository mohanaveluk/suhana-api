import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean, IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min,
} from 'class-validator';
import { IntentSource } from '../enums/search.enums';
import { SearchIntent } from '../models/search-intent.model';
import { User } from 'src/modules/user/entity/user.entity';

export class AiSearchRequestDto {
  @ApiProperty({
    example: 'Find me a caring, family-oriented doctor in Texas',
    description: 'Natural-language search query',
    maxLength: 500,
  })
  @IsNotEmpty({ message: 'query must not be empty' })
  @IsString()
  @MaxLength(500)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  query: string;

  @ApiPropertyOptional({ example: 1, default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ example: 20, default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @ApiPropertyOptional({
    example: false,
    default: false,
    description:
      'Bypass the cached intent for this query and re-parse from scratch. ' +
      'Useful after dictionary changes; costs an LLM call if confidence is low.',
  })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  refreshIntent?: boolean;
}

export class SearchProfileResultDto {
  @ApiProperty({ example: 'p123' })
  profileId: string;

  @ApiProperty({ example: 'p123' })
  user: User | null;

  @ApiProperty({ example: 'p123' })
  userId: string;

  @ApiPropertyOptional({ example: 'SUH-00123' })
  profileCode: string | null;

  @ApiProperty({ example: 'Nandhini' })
  firstName: string;

  @ApiPropertyOptional({ example: 'R' })
  lastName: string | null;

  @ApiPropertyOptional({ example: 29 })
  age: number | null;

  @ApiPropertyOptional({ example: '1997-05-15T00:00:00.000Z' })
  dateOfBirth: Date | null;

  @ApiPropertyOptional({ example: 'bride' })
  gender: string | null;

  @ApiPropertyOptional({ example: 'Vishwakarma' })
  caste: string | null;

  @ApiPropertyOptional({ example: 'Doctor' })
  occupationTitle: string | null;

  @ApiPropertyOptional({ example: 'Masters' })
  educationLevel: string | null;

  @ApiPropertyOptional({ example: 'Hindu' })
  religion: string | null;

  @ApiPropertyOptional({ example: 'Tamil' })
  motherTongue: string | null;

  @ApiPropertyOptional({ example: { city: 'Dallas', state: 'Texas', country: 'USA' } })
  location: { city: string | null; state: string | null; country: string | null, willingToRelocate: boolean };

  @ApiPropertyOptional({ example: '5.9' })
  height: string | null;

  @ApiPropertyOptional({ example: '150' })
  weight: string | null;

  @ApiPropertyOptional({ example: 'Fair' })
  complexion: string | null;

  @ApiPropertyOptional({ example: 'I am a caring and family-oriented person...' })
  aboutMe: string | null;

  @ApiPropertyOptional({
    example: { level: 'Masters', field: 'Computer Science', institution: 'MIT' },
    description: 'Structured education details',
  })
  education: { level: string | null; field: string | null, institution: string | null };

  @ApiPropertyOptional({
    example: { title: 'Software Engineer', company: 'Google', industry: 'Technology', annualIncome: '100000', workingStatus: 'Employed' },
    description: 'Structured occupation details', 
  })
  occupation: { title: string | null; company: string | null, industry?: string | null, annualIncome: string | null, workingStatus: string | null };

  @ApiPropertyOptional({
    example: {
      familyType: 'nuclear',
      familyValues: 'traditional',
      fatherOccupation: 'Engineer',
      motherOccupation: 'Teacher',
      siblings: 2,
      brothersCount: 1,
      sistersCount: 1,
      familyPreferenceNote: 'Looking for a bride from a similar background.',
    },
    description: 'Structured family details',
  })
  familyDetails: {
    familyType?: string | null;
    familyValues?: string | null;
    fatherOccupation?: string | null;
    motherOccupation?: string | null;
    siblings?: number | null;
    brothersCount?: number | null;
    sistersCount?: number | null;
    familyPreferenceNote?: string | null;
  };

  @ApiPropertyOptional({
    example: [
      {
        id: 'photo123',
        url: 'https://storage.googleapis.com/.../photo.jpg',
        isPrimary: true,
        variants: {
          originalUrl: 'https://storage.googleapis.com/.../photo_original.jpg',
          displayUrl: 'https://storage.googleapis.com/.../photo_display.jpg',
          thumbnailUrl: 'https://storage.googleapis.com/.../photo_thumbnail.jpg',
        },
        createdAt: new Date('2026-08-01T10:00:00.000Z'),
        isVerified: true,
      },
    ],
    description: 'Profile photos with metadata',
  })
  photos: {
    id: string; url: string; isPrimary?: boolean, variants: {
      originalUrl?: string;
      displayUrl?: string;
      thumbnailUrl?: string;
    }, 
    createdAt: Date, 
    isVerified: boolean
  }[];

  @ApiPropertyOptional({ example: 'public' })
  photoPrivacy: string | null;

  @ApiPropertyOptional({ example: 'active' })
  status: string | null;

  @ApiPropertyOptional({ example: 85 })
  profileCompleteness: number | null;

  @ApiPropertyOptional({ example: 'https://storage.googleapis.com/.../video.mp4' })
  videoIntroUrl: string | null;

  @ApiPropertyOptional({ example: 'traditional' })
  familyValues?: string | null;

  @ApiPropertyOptional({ example: 'nuclear' })
  familyType: string | null;

  @ApiPropertyOptional({
    example: 'Never Married',
    description: 'Null when the member has not stated it — the field post-dates older profiles.',
  })
  maritalStatus: string | null;

  @ApiPropertyOptional({ example: ['travel', 'music'], description: 'Profile.interests' })
  interests: string[];

  @ApiPropertyOptional({ example: true })
  willingToRelocate: boolean;

  @ApiPropertyOptional({ example: 'https://storage.googleapis.com/.../photo.jpg' })
  primaryPhotoUrl: string | null;

  @ApiPropertyOptional({ description: 'Voice introduction URL, when the member recorded one' })
  voiceIntroductionUrl: string | null;

  @ApiProperty({
    example: 87,
    description: 'Relevance score 0-100 from the ranking engine — how well this profile fits the intent',
  })
  matchScore: number;

  @ApiProperty({
    example: {
      profession: 25, location: 20, education: 15,
      familyValues: 12, personality: 8, horoscope: 7,
    },
    description: 'Per-dimension contribution to matchScore, for "why am I seeing this?" UI',
  })
  scoreBreakdown: Record<string, number>;

  @ApiProperty({
    example: ['Same profession', 'Located in Texas', 'Family-oriented'],
    description: 'Human-readable reasons this profile matched',
  })
  matchReasons: string[];

  @ApiPropertyOptional({ example: '2026-08-01T10:00:00.000Z' })
  lastActive: Date | null;
}

export class AiSearchResponseDto {
  @ApiProperty({
    description: 'The structured intent extracted from the query',
    example: {
      profession: 'Doctor',
      state: 'Texas',
      personalityTraits: ['caring', 'family-oriented'],
    },
  })
  searchIntent: SearchIntent;

  @ApiProperty({
    example: 94,
    description: 'Parser confidence 0-100. Below 80 the AI fallback is invoked.',
  })
  confidence: number;

  @ApiProperty({
    enum: IntentSource,
    example: IntentSource.LOCAL,
    description: 'How the intent was produced — LOCAL, CACHE, AI_FALLBACK or LOCAL_DEGRADED',
  })
  intentSource: IntentSource;

  @ApiProperty({ example: 120 })
  totalResults: number;

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 20 })
  limit: number;

  @ApiProperty({ example: 6 })
  totalPages: number;

  @ApiProperty({ type: [SearchProfileResultDto] })
  profiles: SearchProfileResultDto[];

  @ApiProperty({
    example: ['Try adding a location', 'Show software engineers in Dallas'],
    description: 'Follow-up query suggestions, tailored when a search returns little or nothing',
  })
  suggestions: string[];

  @ApiProperty({
    example: { docotr: 'Doctor' },
    description: 'Spelling corrections the fuzzy matcher applied, for "showing results for..." UI',
  })
  corrections: Record<string, string>;

  @ApiProperty({ example: 42, description: 'Server-side search time in milliseconds' })
  searchTimeMs: number;
}

export enum SuggestionType {
  /** Finishes the word currently being typed — "Hindu bri" → "Hindu bride". */
  COMPLETION = 'COMPLETION',
  /** Adds a facet the query has not constrained yet. */
  REFINEMENT = 'REFINEMENT',
  /** A query other members actually run. Empty-input only. */
  POPULAR = 'POPULAR',
  /** Curated example. Empty-input only, when there is no history to draw on. */
  EXAMPLE = 'EXAMPLE',
}

export class SuggestionItemDto {
  @ApiProperty({
    example: 'Hindu bride from Texas',
    description: 'The full query to run if the member picks this suggestion',
  })
  text: string;

  @ApiProperty({
    enum: SuggestionType,
    example: SuggestionType.REFINEMENT,
    description: 'What kind of suggestion this is — lets the UI badge or group them',
  })
  type: SuggestionType;

  @ApiPropertyOptional({
    example: 'state',
    description: 'Which facet this suggestion adds. Null for popular/example entries.',
  })
  facet: string | null;

  @ApiPropertyOptional({
    example: 'Texas',
    description: 'The canonical value being proposed for that facet',
  })
  value?: string | null;
}

export class SearchSuggestionsResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({
    example: 'Hindu bride',
    description: 'The partial query these suggestions were generated for',
  })
  query: string;

  @ApiProperty({
    type: [SuggestionItemDto],
    example: [
      { text: 'Hindu bride from Texas', type: 'REFINEMENT', facet: 'state', value: 'Texas' },
      { text: "Hindu bride with a Master's degree", type: 'REFINEMENT', facet: 'education', value: 'Masters' },
      { text: 'Hindu bride working as a Doctor', type: 'REFINEMENT', facet: 'profession', value: 'Doctor' },
      { text: 'Hindu bride aged 25-30', type: 'REFINEMENT', facet: 'age', value: '25-30' },
    ],
  })
  data: SuggestionItemDto[];
}

export class SaveSearchDto {
  @ApiProperty({ example: 'Find me a caring, family-oriented doctor in Texas', maxLength: 500 })
  @IsNotEmpty()
  @IsString()
  @MaxLength(500)
  query: string;

  @ApiPropertyOptional({
    example: 'Doctors in Texas',
    description: 'Label for this saved search. Defaults to the query text.',
    maxLength: 200,
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;
}

export class SavedSearchItemDto {
  @ApiProperty({ example: 'uuid-...' })
  id: string;

  @ApiProperty({ example: 'uuid-...' })
  guid: string;

  @ApiProperty({ example: 'Doctors in Texas' })
  name: string;

  @ApiProperty({ example: 'Find me a caring, family-oriented doctor in Texas' })
  query: string;

  @ApiPropertyOptional({ description: 'Intent captured at save time — replayed without re-parsing' })
  parsedIntent: SearchIntent | null;

  @ApiProperty({ example: 120 })
  resultCountAtSave: number;

  @ApiPropertyOptional({ example: '2026-08-06T12:00:00.000Z' })
  lastRunAt: Date | null;

  @ApiProperty({ example: '2026-08-01T12:00:00.000Z' })
  createdAt: Date;
}

export class PopularSearchItemDto {
  @ApiProperty({ example: 'find a doctor in texas' })
  query: string;

  @ApiProperty({ example: 148, description: 'Times this query was run in the window' })
  searchCount: number;

  @ApiProperty({ example: 92, description: 'Average result count — a low value signals a weak query' })
  averageResults: number;
}

export class RecentSearchItemDto {
  @ApiProperty({ example: 'Find me a caring doctor in Texas' })
  query: string;

  @ApiProperty({ example: 34 })
  resultCount: number;

  @ApiProperty({ example: 94 })
  confidence: number;

  @ApiProperty({ example: '2026-08-06T12:00:00.000Z' })
  createdAt: Date;
}

export class SearchAnalyticsResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 'Popular searches fetched successfully.' })
  message: string;

  @ApiProperty({ type: [PopularSearchItemDto] })
  data: PopularSearchItemDto[] | RecentSearchItemDto[] | SavedSearchItemDto[];
}
