import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('lookup_occupation_titles')
export class OccupationTitle {
  @PrimaryGeneratedColumn()
  id: number;

  @Index({ unique: true })
  @Column({ length: 150 })
  name: string;

  @Column({ length: 150, nullable: true })
  category: string;

  @CreateDateColumn()
  createdAt: Date;
}
