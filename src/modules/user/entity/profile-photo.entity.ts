import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn, JoinColumn } from 'typeorm';
import { Profile } from './profile.entity';
import { create } from 'node_modules/axios/index.cjs';

@Entity('profile_photos')
export class ProfilePhoto {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({length: 1000})
  url: string;

  @Column({ type: 'json', nullable: true })
  variants: { originalUrl?: string, displayUrl?: string, thumbnailUrl?: string };

  @Column({ default: false })
  isPrimary: boolean;

  @Column({ default: false })
  isVerified: boolean;

  @Column({ default: '1' })
  isActive: number

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => Profile, (profile) => profile.photos, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'profileId' })
  profile: Profile;
}
