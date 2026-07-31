import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index,
} from 'typeorm';
import { SuccessStoryStatus, MarriageVerificationStatus } from '../enums/testimonial.enums';

@Entity('success_story')
@Index('IDX_story_status_featured', ['status', 'isFeatured'])
export class SuccessStory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 36, name: 'groom_profile_id', nullable: true })
  groomProfileId: string | null;

  @Column({ type: 'varchar', length: 36, name: 'bride_profile_id', nullable: true })
  brideProfileId: string | null;

  @Column({ type: 'varchar', length: 150, name: 'groom_name' })
  groomName: string;

  @Column({ type: 'varchar', length: 150, name: 'bride_name' })
  brideName: string;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'text' })
  story: string;

  @Column({ type: 'date', name: 'engagement_date', nullable: true })
  engagementDate: Date | null;

  @Column({ type: 'date', name: 'marriage_date', nullable: true })
  marriageDate: Date | null;

  @Column({ type: 'varchar', length: 1000, name: 'photo_url', nullable: true })
  photoUrl: string | null;

  @Column({ type: 'json', name: 'gallery_urls', nullable: true })
  galleryUrls: string[] | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  location: string | null;

  @Index('IDX_story_is_featured')
  @Column({ type: 'boolean', default: false, name: 'is_featured' })
  isFeatured: boolean;

  @Index('IDX_story_status')
  @Column({ type: 'enum', enum: SuccessStoryStatus, default: SuccessStoryStatus.PENDING })
  status: SuccessStoryStatus;

  // ── Verified Marriage Badge ───────────────────────────────────────────────
  @Column({ type: 'varchar', length: 1000, name: 'wedding_photo_url', nullable: true })
  weddingPhotoUrl: string | null;

  @Column({ type: 'varchar', length: 1000, name: 'wedding_invitation_url', nullable: true })
  weddingInvitationUrl: string | null;

  @Column({ type: 'varchar', length: 1000, name: 'marriage_certificate_url', nullable: true })
  marriageCertificateUrl: string | null;

  @Index('IDX_story_marriage_verification')
  @Column({
    type: 'enum',
    enum: MarriageVerificationStatus,
    default: MarriageVerificationStatus.PENDING,
    name: 'marriage_verification_status',
  })
  marriageVerificationStatus: MarriageVerificationStatus;

  @Column({ type: 'boolean', default: false, name: 'verified_marriage' })
  verifiedMarriage: boolean;

  @Column({ type: 'varchar', length: 36, name: 'verified_by', nullable: true })
  verifiedBy: string | null;

  @Column({ type: 'datetime', name: 'verified_at', nullable: true })
  verifiedAt: Date | null;

  @Column({ type: 'varchar', length: 36, name: 'created_by' })
  createdBy: string;

  @Column({ type: 'varchar', length: 36, name: 'approved_by', nullable: true })
  approvedBy: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date | null;
}
