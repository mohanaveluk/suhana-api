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

  @Column({ type: 'enum', enum: ['audio', 'video'] })
  type: string;

  @Column({
    type: 'enum',
    enum: ['initiated', 'ongoing', 'ended', 'missed'],
    default: 'initiated',
  })
  status: string;

  @CreateDateColumn()
  startedAt: Date;

  @Column({ type: 'datetime', nullable: true })
  endedAt: Date;

  @Column({ nullable: true })
  duration: number;
}
