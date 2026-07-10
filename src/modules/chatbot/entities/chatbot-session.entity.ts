import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn,
  ManyToOne, JoinColumn, Index, BeforeInsert,
} from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { User } from '../../user/entity/user.entity';
import { SessionStatus } from '../enums/session-status.enum';

@Entity('chatbot_session')
@Index('IDX_CB_SESSION_USER', ['userId'])
@Index('IDX_CB_SESSION_STATUS', ['status'])
export class ChatbotSession {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 36, unique: true })
  guid: string;

  @BeforeInsert()
  generateGuid() {
    if (!this.guid) this.guid = uuidv4();
  }

  @Column({ type: 'varchar', length: 36, nullable: true, name: 'user_id' })
  userId: string;

  @ManyToOne(() => User, { eager: false, nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column({ type: 'enum', enum: SessionStatus, default: SessionStatus.ACTIVE })
  status: SessionStatus;

  @Column({ type: 'datetime', name: 'started_at', default: () => 'CURRENT_TIMESTAMP' })
  startedAt: Date;

  @Column({ type: 'datetime', nullable: true, name: 'ended_at' })
  endedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
