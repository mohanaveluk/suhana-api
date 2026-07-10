import {
  Entity, PrimaryGeneratedColumn, Column,
  CreateDateColumn, UpdateDateColumn, Index,
} from 'typeorm';
import { SafetyCategory } from '../enums/safety-category.enum';

@Entity('safety_tips')
@Index('IDX_SAFETY_TIPS_CATEGORY', ['category', 'isPublished', 'isDeleted'])
@Index('IDX_SAFETY_TIPS_FEATURED', ['isFeatured', 'isPublished', 'isDeleted'])
@Index('IDX_SAFETY_TIPS_ORDER', ['displayOrder', 'isPublished'])
export class SafetyTip {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'varchar', length: 500, name: 'short_description' })
  shortDescription: string;

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'enum', enum: SafetyCategory, default: SafetyCategory.REPORTING_ABUSE })
  category: SafetyCategory;

  @Column({ type: 'varchar', length: 100, nullable: true })
  icon: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true, name: 'image_url' })
  imageUrl: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true, name: 'video_url' })
  videoUrl: string | null;

  @Column({ type: 'int', default: 0, name: 'display_order' })
  displayOrder: number;

  @Column({ type: 'boolean', default: false, name: 'is_featured' })
  isFeatured: boolean;

  @Column({ type: 'boolean', default: false, name: 'is_published' })
  isPublished: boolean;

  @Column({ type: 'int', default: 0, unsigned: true, name: 'view_count' })
  viewCount: number;

  @Column({ type: 'boolean', default: false, name: 'is_deleted' })
  isDeleted: boolean;

  @Column({ type: 'datetime', nullable: true, name: 'deleted_at' })
  deletedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
