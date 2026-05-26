import { Entity, Column, PrimaryGeneratedColumn, OneToMany } from 'typeorm';
import { User } from './user.entity';

@Entity('roles')
export class RoleEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({nullable: false,  length: 100})
  guid: string;

  @Column({nullable: false, length: 100})
  name: string;

  @Column({nullable: false, length: 1})
  is_active: string;

  @OneToMany(() => User, (user) => user.role)
  users: User[];
}