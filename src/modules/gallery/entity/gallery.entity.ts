import {
  Entity,
  PrimaryColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  BeforeInsert,
  Index,
} from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { Profile } from '../../user/entity/profile.entity';
import PhotoVariant from '../../../shared/models/PhotoVariant';

@Entity('gallery')
export class Gallery {
  // ── Primary Key ────────────────────────────────────────────────────────────
  @PrimaryColumn({ type: 'varchar', length: 36, name: 'id' })
  id: string;

  @BeforeInsert()
  generateId() {
    if (!this.id) {
      this.id = uuidv4();
    }
  }

  // ── Foreign Key ────────────────────────────────────────────────────────────
  @Index('idx_gallery_profile_id')
  @Column({ type: 'varchar', length: 36, name: 'profile_id' })
  profileId: string;

  // ── Image Metadata ─────────────────────────────────────────────────────────
  @Column({ type: 'text', name: 'image_url' })
  imageUrl: string;

  @Column({ type: 'json', nullable: true })
  variants: PhotoVariant;

  @Column({ type: 'varchar', length: 255, name: 'image_name', nullable: true })
  imageName: string;

  @Column({ type: 'int', name: 'image_size', nullable: true, unsigned: true })
  imageSize: number;

  @Column({ type: 'varchar', length: 100, name: 'mime_type', nullable: true })
  mimeType: string;

  // ── Audit ──────────────────────────────────────────────────────────────────
  @Column({ type: 'varchar', length: 36, name: 'uploaded_by', nullable: true })
  uploadedBy: string;

  // ── Timestamps ─────────────────────────────────────────────────────────────
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Column({ type: 'datetime', name: 'deleted_at', nullable: true })
  deletedAt: Date | null;

  // ── Soft Delete ────────────────────────────────────────────────────────────
  @Index('idx_gallery_is_deleted')
  @Column({ type: 'boolean', name: 'is_deleted', default: false })
  isDeleted: boolean;

  // ── Relation ───────────────────────────────────────────────────────────────
  @ManyToOne(() => Profile, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'profile_id' })
  profile?: Profile;
}
