export type MessageSource = 'FAQ' | 'KNOWLEDGE' | 'AI' | 'CACHE' | 'NONE';

export interface ChatbotResponse {
  messageId: string;
  answer: string;
  source: MessageSource;
  confidence: number;
  suggestions: string[];
  tokensUsed?: number;
  responseTimeMs?: number;
}

export interface UserContextInfo {
  userId: string;
  name: string;
  membership: string;
  profileCompleteness: number;
  photoCount: number;
  interestCount: number;
}
