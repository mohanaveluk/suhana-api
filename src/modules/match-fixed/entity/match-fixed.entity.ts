import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  UpdateDateColumn, ManyToOne, JoinColumn, Generated, Index,
} from 'typeorm';
import { User } from '../../user/entity/user.entity';
import { MatchSourceType } from '../enums/match-source-type.enum';
import { MatchFixedStatus } from '../enums/match-fixed-status.enum';
import { VerificationMethod } from '../enums/verification-method.enum';

@Entity('match_fixed')
@Index('IDX_MF_STATUS_PUBLISH', ['status', 'allowStoryPublish'])
@Index('IDX_MF_USER_STATUS', ['userId', 'status'])
@Index('IDX_MF_SUHANA_FLAG', ['isMatchFromSuhana'])
@Index('IDX_MF_VERIFIED', ['isVerified', 'status'])
export class MatchFixed {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  @Generated('uuid')
  guid: string;

  @Column()
  userId: string;

  @ManyToOne(() => User, { eager: false })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'enum', enum: MatchSourceType })
  matchSourceType: MatchSourceType;

  @Column({ default: false })
  isMatchFromSuhana: boolean;

  @Column({ nullable: true })
  matchedUserId: string;

  @ManyToOne(() => User, { eager: false, nullable: true })
  @JoinColumn({ name: 'matchedUserId' })
  matchedUser: User;

  @Column({ type: 'uuid', nullable: true })
  matchedUserGuid: string;

  @Column({ nullable: true, length: 200 })
  partnerName: string;

  @Column({ nullable: true })
  partnerAge: number;

  @Column({ nullable: true, length: 200 })
  partnerProfession: string;

  @Column({ nullable: true, length: 500 })
  partnerLocation: string;

  @Column({ type: 'json', nullable: true})
  partnerPhotoUrl?: { originalUrl?: string, displayUrl?: string, thumbnailUrl?: string };

  // Additional photo fields for homepage display
  @Column({ type: 'json', nullable: true})
  engagementPhotoUrl?: { originalUrl?: string, displayUrl?: string, thumbnailUrl?: string };

  @Column({ type: 'json', nullable: true })
  weddingPhotoUrl?: { originalUrl?: string, displayUrl?: string, thumbnailUrl?: string };

  @Column({ type: 'date', nullable: true })
  engagementDate: Date;

  @Column({ type: 'date', nullable: true })
  marriageDate: Date;

  @Column({ type: 'text', nullable: true })
  successStory: string;

  @Column({ default: false })
  allowStoryPublish: boolean;

  @Column({ default: false })
  allowPhotoPublish: boolean;

  // Verification — either the matched partner confirms, or an admin confirms on
  // their behalf when the partner is not a Suhana user (external matches).
  @Column({ default: false })
  isVerified: boolean;

  @Column({ type: 'datetime', nullable: true })
  verifiedAt: Date;

  // The Suhana user ID of the partner who confirmed this match.
  // Only set for PARTNER verification; kept for backwards compatibility.
  @Column({ nullable: true })
  verifiedByPartnerId: string;

  @Column({ type: 'enum', enum: VerificationMethod, nullable: true })
  verificationMethod: VerificationMethod;

  // The Suhana user ID of whoever verified — the partner, or the admin
  @Column({ nullable: true })
  verifiedByUserId: string;

  // Admin's free-text note recording why the match was accepted as genuine
  @Column({ type: 'text', nullable: true })
  verificationNote: string;

  @Column({ type: 'enum', enum: MatchFixedStatus, default: MatchFixedStatus.ACTIVE })
  status: MatchFixedStatus;

  @Column({ nullable: true })
  createdBy: string;

  @Column({ nullable: true })
  updatedBy: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
