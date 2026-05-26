import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';
import { Profile } from './profile.entity';

@Entity('profile_photos')
export class ProfilePhoto {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  url: string;

  @Column({ default: false })
  isPrimary: boolean;

  @Column({ default: false })
  isVerified: boolean;

  @ManyToOne(() => Profile, (profile) => profile.photos, { onDelete: 'CASCADE' })
  profile: Profile;
}
