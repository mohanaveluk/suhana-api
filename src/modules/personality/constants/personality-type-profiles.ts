import { PersonalityTypeCode } from '../enums/personality.enums';

/**
 * Insight copy per personality type, written for a matrimony audience.
 * Keyed by type code so a localisation layer can replace it per locale later.
 */
export interface PersonalityTypeProfile {
  title: string;
  summary: string;
  strengths: string[];
  growthAreas: string[];
  inRelationships: string;
}

export const PERSONALITY_TYPE_PROFILES: Record<
  PersonalityTypeCode,
  PersonalityTypeProfile
> = {
  INTJ: {
    title: 'The Strategist',
    summary:
      'Independent, analytical and future-focused, you like to understand how things work and plan the path ahead.',
    strengths: [
      'Long-term planning',
      'Independent thinking',
      'Calm, rational problem-solving',
    ],
    growthAreas: ['Expressing feelings openly', 'Patience with spontaneity'],
    inRelationships:
      'Loyal and committed, you show love by building a stable, well-planned future and value a partner who respects your need for thinking time.',
  },
  INTP: {
    title: 'The Thinker',
    summary:
      'Curious and inventive, you enjoy exploring ideas and finding logical explanations for everything.',
    strengths: [
      'Creative problem-solving',
      'Open-mindedness',
      'Intellectual curiosity',
    ],
    growthAreas: ['Following through on practical tasks', 'Sharing emotions'],
    inRelationships:
      'Easy-going and accepting, you value deep conversations and a partner who gives you freedom to explore your interests.',
  },
  ENTJ: {
    title: 'The Leader',
    summary:
      'Confident and decisive, you naturally organise people and resources to achieve ambitious goals.',
    strengths: ['Decisive leadership', 'Goal setting', 'Clear communication'],
    growthAreas: ['Slowing down to listen', 'Showing softer emotions'],
    inRelationships:
      'Committed and protective, you invest in building a strong family future and appreciate a partner who shares your drive.',
  },
  ENTP: {
    title: 'The Innovator',
    summary:
      'Quick-witted and energetic, you love new ideas, lively debate and creative possibilities.',
    strengths: ['Adaptability', 'Creative thinking', 'Energetic enthusiasm'],
    growthAreas: ['Consistency with routines', 'Sensitivity in debate'],
    inRelationships:
      'Fun and stimulating, you keep life exciting and value a partner who enjoys growing and exploring together.',
  },
  INFJ: {
    title: 'The Counselor',
    summary:
      'Insightful and principled, you seek meaning and care deeply about the people close to you.',
    strengths: ['Deep empathy', 'Strong values', 'Thoughtful insight'],
    growthAreas: ['Voicing your own needs', 'Letting go of perfectionism'],
    inRelationships:
      'Devoted and understanding, you seek a soulful connection built on trust, shared values and meaningful conversation.',
  },
  INFP: {
    title: 'The Idealist',
    summary:
      'Gentle, creative and value-driven, you are guided by a strong inner sense of what matters.',
    strengths: ['Compassion', 'Creativity', 'Authenticity'],
    growthAreas: ['Handling conflict directly', 'Practical planning'],
    inRelationships:
      'Romantic and caring, you give wholehearted support and look for a partner who accepts you for who you truly are.',
  },
  ENFJ: {
    title: 'The Mentor',
    summary:
      'Warm and inspiring, you bring people together and help them grow.',
    strengths: [
      'Encouraging others',
      'Strong communication',
      'Organising family and friends',
    ],
    growthAreas: [
      'Taking time for yourself',
      'Accepting differing opinions calmly',
    ],
    inRelationships:
      'Generous and attentive, you work hard to keep harmony at home and value a partner who shares your commitment to family.',
  },
  ENFP: {
    title: 'The Champion',
    summary:
      'Enthusiastic and imaginative, you see possibilities everywhere and connect easily with people.',
    strengths: ['Optimism', 'Warmth', 'Creativity'],
    growthAreas: [
      'Finishing what you start',
      'Managing routine responsibilities',
    ],
    inRelationships:
      'Affectionate and supportive, you bring joy and adventure, and value a partner who shares your curiosity about life.',
  },
  ISTJ: {
    title: 'The Guardian',
    summary:
      'Responsible, practical and dependable, you honour commitments and value tradition.',
    strengths: ['Reliability', 'Attention to detail', 'Strong sense of duty'],
    growthAreas: ['Openness to change', 'Expressing affection verbally'],
    inRelationships:
      'Steady and faithful, you show love through dependable actions and value a partner who respects family and commitment.',
  },
  ISFJ: {
    title: 'The Nurturer',
    summary:
      'Kind, loyal and attentive, you quietly take care of the people you love.',
    strengths: ['Caring support', 'Loyalty', 'Practical help'],
    growthAreas: ['Asking for what you need', 'Saying no when necessary'],
    inRelationships:
      'Devoted and thoughtful, you create a warm, secure home and appreciate a partner who notices your quiet efforts.',
  },
  ESTJ: {
    title: 'The Organizer',
    summary:
      'Practical and structured, you get things done and keep life running smoothly.',
    strengths: ['Organisation', 'Decisiveness', 'Dependability'],
    growthAreas: ['Flexibility', 'Considering feelings in decisions'],
    inRelationships:
      'Committed and responsible, you provide stability and clear direction, and value a partner who honours shared responsibilities.',
  },
  ESFJ: {
    title: 'The Caregiver',
    summary:
      'Sociable and caring, you thrive on helping others and building close-knit communities.',
    strengths: ['Hospitality', 'Loyalty', 'Attentiveness to others'],
    growthAreas: ['Handling criticism', 'Prioritising your own needs'],
    inRelationships:
      'Warm and devoted, you put family first and value a partner who appreciates togetherness and tradition.',
  },
  ISTP: {
    title: 'The Craftsman',
    summary:
      'Calm, observant and hands-on, you solve practical problems with skill and ease.',
    strengths: [
      'Practical problem-solving',
      'Composure under pressure',
      'Independence',
    ],
    growthAreas: ['Long-term planning', 'Sharing feelings'],
    inRelationships:
      'Easy-going and loyal, you show care through actions and value a partner who respects your independence.',
  },
  ISFP: {
    title: 'The Artist',
    summary:
      'Gentle, sensitive and creative, you enjoy beauty and living in the moment.',
    strengths: ['Kindness', 'Aesthetic sense', 'Flexibility'],
    growthAreas: ['Planning ahead', 'Addressing conflict openly'],
    inRelationships:
      'Warm and accepting, you bring tenderness and quiet loyalty, and value a partner who gives you space to be yourself.',
  },
  ESTP: {
    title: 'The Dynamo',
    summary:
      'Energetic and action-oriented, you love excitement and think quickly on your feet.',
    strengths: ['Adaptability', 'Confidence', 'Practical action'],
    growthAreas: ['Patience', 'Considering long-term consequences'],
    inRelationships:
      'Lively and generous, you keep life fun and value a partner who enjoys new experiences with you.',
  },
  ESFP: {
    title: 'The Entertainer',
    summary:
      'Fun-loving and spontaneous, you bring energy and warmth wherever you go.',
    strengths: ['Enthusiasm', 'Generosity', 'Making people feel welcome'],
    growthAreas: ['Long-term planning', 'Staying with difficult conversations'],
    inRelationships:
      'Affectionate and playful, you fill your home with joy and value a partner who shares your zest for life.',
  },
};
