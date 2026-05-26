import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn,
} from 'typeorm';
import { Conversation } from './conversation.entity';

@Entity('messages')
export class Message {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Conversation, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'conversationId' })
  conversation: Conversation;

  @Column()
  conversationId: string;

  @Column()
  senderId: string;

  @Column()
  receiverId: string;

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'enum', enum: ['text', 'icebreaker', 'system'], default: 'text' })
  type: string;

  @Column({ default: false })
  isRead: boolean;

  @CreateDateColumn()
  timestamp: Date;
}
