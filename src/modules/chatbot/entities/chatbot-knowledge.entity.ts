import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn, Index,
} from 'typeorm';
import { ChatbotCategory } from '../enums/chatbot-category.enum';

@Entity('chatbot_knowledge')
@Index('IDX_KNOWLEDGE_CATEGORY_ACTIVE', ['category', 'isActive'])
export class ChatbotKnowledge {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'enum', enum: ChatbotCategory, default: ChatbotCategory.GENERAL })
  category: ChatbotCategory;

  @Column({ type: 'varchar', length: 500, nullable: true })
  tags: string | null;

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'boolean', default: true, name: 'is_active' })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
