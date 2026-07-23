import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn,
} from 'typeorm';
import { User } from '../../user/entity/user.entity';
import { Conversation } from '../../user/entity/conversation.entity';

@Entity('calls')
export class Call {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  conversationId: string;

  @ManyToOne(() => Conversation, { eager: false })
  @JoinColumn({ name: 'conversationId' })
  conversation: Conversation;

  @Column()
  initiatedBy: string;

  @ManyToOne(() => User, { eager: false })
  @JoinColumn({ name: 'initiatedBy' })
  initiator: User;

  @Column({ nullable: true })
  receiverId: string;

  @ManyToOne(() => User, { eager: false })
  @JoinColumn({ name: 'receiverId' })
  receiver: User;

  @Column({ type: 'enum', enum: ['audio', 'video'] })
  type: string;

  @Column({
    type: 'enum',
    enum: ['PENDING', 'RINGING', 'ACCEPTED', 'DECLINED', 'MISSED', 'COMPLETED', 'FAILED'],
    default: 'PENDING',
  })
  status: string;

  @CreateDateColumn()
  startedAt: Date;

  @Column({ type: 'datetime', nullable: true })
  answeredAt: Date;

  @Column({ type: 'datetime', nullable: true })
  endedAt: Date;

  @Column({ nullable: true })
  durationSeconds: number;

  @Column({ nullable: true })
  callerSocketId: string;

  @Column({ nullable: true })
  receiverSocketId: string;
}
