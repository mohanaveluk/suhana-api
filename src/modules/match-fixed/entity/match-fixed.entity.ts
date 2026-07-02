import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  UpdateDateColumn, ManyToOne, JoinColumn, Generated, Index,
} from 'typeorm';
import { User } from '../../user/entity/user.entity';
import { MatchSourceType } from '../enums/match-source-type.enum';
import { MatchFixedStatus } from '../enums/match-fixed-status.enum';

@Entity('match_fixed')
@Index('IDX_MF_STATUS_PUBLISH', ['status', 'allowStoryPublish'])
@Index('IDX_MF_USER_STATUS', ['userId', 'status'])
@Index('IDX_MF_SUHANA_FLAG', ['isMatchFromSuhana'])
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

  @Column({ nullable: true, length: 500 })
  partnerPhotoUrl: string;

  // Additional photo fields for homepage display
  @Column({ nullable: true, length: 500 })
  engagementPhotoUrl: string;

  @Column({ nullable: true, length: 500 })
  weddingPhotoUrl: string;

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

  // Verification — both profiles confirm the match
  @Column({ default: false })
  isVerified: boolean;

  @Column({ type: 'datetime', nullable: true })
  verifiedAt: Date;

  // The Suhana user ID of the partner who confirmed this match
  @Column({ nullable: true })
  verifiedByPartnerId: string;

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
