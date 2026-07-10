import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn, Index,
} from 'typeorm';
import { ChatbotCategory } from '../enums/chatbot-category.enum';

@Entity('faq')
@Index('IDX_FAQ_CATEGORY_ACTIVE', ['category', 'isActive'])
@Index('IDX_FAQ_ORDER', ['displayOrder', 'isActive'])
export class Faq {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 500 })
  question: string;

  @Column({ type: 'text' })
  answer: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  keywords: string | null;

  @Column({ type: 'enum', enum: ChatbotCategory, default: ChatbotCategory.GENERAL })
  category: ChatbotCategory;

  @Column({ type: 'int', name: 'display_order', default: 0 })
  displayOrder: number;

  @Column({ type: 'boolean', default: true, name: 'is_active' })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
