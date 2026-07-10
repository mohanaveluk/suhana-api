import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, ManyToOne, JoinColumn, Index, BeforeInsert,
} from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { ChatbotSession } from './chatbot-session.entity';
import { MessageRole } from '../enums/message-role.enum';

@Entity('chatbot_message')
@Index('IDX_CB_MSG_SESSION', ['sessionId'])
@Index('IDX_CB_MSG_USER', ['userId'])
@Index('IDX_CB_MSG_SOURCE', ['source'])
export class ChatbotMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 36, unique: true })
  guid: string;

  @BeforeInsert()
  generateGuid() {
    if (!this.guid) this.guid = uuidv4();
  }

  @Column({ type: 'varchar', length: 36, name: 'session_id' })
  sessionId: string;

  @ManyToOne(() => ChatbotSession, { eager: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'session_id' })
  session: ChatbotSession;

  @Column({ type: 'varchar', length: 36, nullable: true, name: 'user_id' })
  userId: string | null;

  @Column({ type: 'enum', enum: MessageRole, default: MessageRole.USER })
  role: MessageRole;

  @Column({ type: 'text' })
  message: string;

  @Column({ type: 'text', nullable: true })
  response: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  source: string | null;

  @Column({ type: 'decimal', precision: 4, scale: 3, nullable: true })
  confidence: number | null;

  @Column({ type: 'int', nullable: true, name: 'tokens_used' })
  tokensUsed: number | null;

  @Column({ type: 'int', nullable: true, name: 'response_time_ms' })
  responseTimeMs: number | null;

  @Column({ type: 'varchar', length: 1000, nullable: true })
  suggestions: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
