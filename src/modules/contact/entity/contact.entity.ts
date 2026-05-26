import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('contact_tbl')
export class Contact {
  @PrimaryGeneratedColumn()
  id: number;

  @Column('text',{name: 'first_name'})
  firstName: string;

  @Column('text',{name: 'last_name'})
  lastName: string;

  @Column()
  email: string;

  @Column({nullable: true})
  mobile: string;

  @Column('text')
  message: string;

  @CreateDateColumn({ type: 'datetime' })
  created_at: Date;
}