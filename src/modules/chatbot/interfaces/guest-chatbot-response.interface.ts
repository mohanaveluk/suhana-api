export type GuestChatbotSource = 'faq' | 'knowledgebase' | 'message' | 'none';

export interface GuestChatbotResponse {
  source: GuestChatbotSource;
  answer: string;
  requiresLogin: boolean;
}
