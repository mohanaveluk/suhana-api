export interface ChatHoroscopeCriteria {
  rashi?: string;
  nakshatra?: string;
  placeOfBirth?: string;
  manglikStatus?: string;
}

export interface ChatProfileSearchCriteria {
  ageMin?: number;
  ageMax?: number;
  religion?: string;
  caste?: string;
  motherTongue?: string;
  city?: string;
  state?: string;
  country?: string;
  educationLevel?: string;
  occupationTitle?: string;
  height?: string;
  weight?: string;
  siblings?: number;
  horoscope?: ChatHoroscopeCriteria;
}

export interface ProfileSearchIntent {
  isProfileSearch: boolean;
  criteria: ChatProfileSearchCriteria;
}

export interface ProfileSearchSummary {
  userId: string; // Profile.id — matches the /profile-view/:id route convention used elsewhere
  firstName: string;
  lastName: string;
  age: number;
  gender: string;
  religion: string;
  caste?: string;
  motherTongue: string;
  height?: string;
  location: { city: string; state: string; country: string };
  education: { level: string; field?: string };
  occupation: { title: string };
  horoscope?: ChatHoroscopeCriteria;
  photos: { id: string; url: string; isPrimary: boolean }[];
  matchPercentage: number;
  compatibilityBreakdown: Record<string, number>;
  badges: { label: string; icon: string; score: number }[];
}
