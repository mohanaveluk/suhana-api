import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
} from 'typeorm';

@Entity('conversations')
export class Conversation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  participantOneId: string;

  @Column()
  participantTwoId: string;

  @Column({ default: 0 })
  unreadCount: number;

  @Column({ default: false })
  isUnlocked: boolean;

  @CreateDateColumn()
  createdAt: Date;
}
