import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('user_blocks')
export class UserBlock {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  blockedByUserId: string;

  @Column()
  blockedUserId: string;

  @CreateDateColumn()
  createdAt: Date;
}
