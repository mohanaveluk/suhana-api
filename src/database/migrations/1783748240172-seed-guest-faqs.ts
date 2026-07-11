import { MigrationInterface, QueryRunner } from 'typeorm';

const QUESTIONS = [
  'How do I register?',
  'How do I send interest?',
  'How does AI matchmaking work?',
  'What is horoscope matching?',
  'How do I upgrade membership?',
  'How do I block a profile?',
];

export class SeedGuestFaqs1783748240172 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO faq (id, question, answer, keywords, category, display_order, is_active) VALUES
      (UUID(), 'How do I register?', 'Create your free profile by clicking Sign Up, verifying your email, and filling in your basic details, partner preferences, and photos. Once your profile is complete, you can start browsing and connecting with matches.', 'register signup sign up create account new profile', 'REGISTRATION', 10, 1),
      (UUID(), 'How do I send interest?', 'Open any profile you like and click the "Send Interest" button. The other member will be notified and can accept or decline it — once accepted, you can start messaging each other.', 'send interest express interest connect profile', 'INTEREST', 20, 1),
      (UUID(), 'How does AI matchmaking work?', 'Our AI matchmaking looks at your profile details, partner preferences, and compatibility factors like community, lifestyle, and interests to score and rank potential matches, then surfaces the most compatible profiles for you each day.', 'ai matchmaking how does work match algorithm', 'MATCHMAKING', 30, 1),
      (UUID(), 'What is horoscope matching?', 'Horoscope matching (kundli/guna milan) compares birth charts — rashi, nakshatra, and other astrological factors — between two profiles to calculate compatibility according to traditional matching rules, alongside our regular compatibility scoring.', 'horoscope matching kundli guna milan rashi nakshatra astrology', 'AI_HOROSCOPE_MATCH', 40, 1),
      (UUID(), 'How do I upgrade membership?', 'Go to the Membership/Plans section, compare the available plans, and click Subscribe on the plan you want. After completing payment, your account is upgraded immediately with that plan''s benefits.', 'upgrade membership plan subscribe premium payment', 'MEMBERSHIP', 50, 1),
      (UUID(), 'How do I block a profile?', 'Open the profile you want to block and select "Block User" from the profile menu. Once blocked, that member can no longer view your profile, message you, or send you interests.', 'block profile block user safety report', 'SAFETY', 60, 1);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const placeholders = QUESTIONS.map(() => '?').join(', ');
    await queryRunner.query(`DELETE FROM faq WHERE question IN (${placeholders})`, QUESTIONS);
  }
}
