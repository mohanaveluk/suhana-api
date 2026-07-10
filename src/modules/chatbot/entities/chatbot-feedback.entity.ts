import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, ManyToOne, JoinColumn, Index,
} from 'typeorm';
import { User } from '../../user/entity/user.entity';
import { ChatbotMessage } from './chatbot-message.entity';
import { ChatbotFeedbackRating } from '../enums/chatbot-feedback.enum';

@Entity('chatbot_feedback')
@Index('IDX_CB_FEEDBACK_MSG', ['messageId'])
@Index('IDX_CB_FEEDBACK_USER', ['userId'])
export class ChatbotFeedback {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 36, name: 'message_id' })
  messageId: string;

  @ManyToOne(() => ChatbotMessage, { eager: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'message_id' })
  chatbotMessage: ChatbotMessage;

  @Column({ type: 'varchar', length: 36, nullable: true, name: 'user_id' })
  userId: string | null;

  @ManyToOne(() => User, { eager: false, nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'enum', enum: ChatbotFeedbackRating })
  rating: ChatbotFeedbackRating;

  @Column({ type: 'text', nullable: true })
  comments: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
