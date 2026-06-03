import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn,
} from 'typeorm';
import { User } from '../../user/entity/user.entity';

@Entity('interests')
export class Interest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  fromUserId: string;

  @ManyToOne(() => User, { eager: false })
  @JoinColumn({ name: 'fromUserId' })
  fromUser: User;

  @Column()
  toUserId: string;

  @ManyToOne(() => User, { eager: false })
  @JoinColumn({ name: 'toUserId' })
  toUser: User;

  @Column({ type: 'text', nullable: true })
  message: string;

  @Column({
    type: 'enum',
    enum: ['pending', 'accepted', 'declined'],
    default: 'pending',
  })
  status: string;

  @CreateDateColumn()
  createdAt: Date;
}
