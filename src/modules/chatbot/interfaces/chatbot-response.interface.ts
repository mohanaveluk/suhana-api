import { ProfileSearchSummary } from './profile-search.interface';

export type MessageSource = 'FAQ' | 'KNOWLEDGE' | 'AI' | 'CACHE' | 'NONE' | 'PROFILE_SEARCH';

export interface ChatbotResponse {
  messageId: string;
  answer: string;
  source: MessageSource;
  confidence: number;
  suggestions: string[];
  tokensUsed?: number;
  responseTimeMs?: number;
  type?: 'text' | 'profile-list';
  profiles?: ProfileSearchSummary[];
}

export interface UserContextInfo {
  userId: string;
  name: string;
  membership: string;
  profileCompleteness: number;
  photoCount: number;
  interestCount: number;
}
