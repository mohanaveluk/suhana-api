import {
  Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn,
  BeforeInsert, Index,
} from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { ImageContext } from '../enums/image-context.enum';
import { UploadedVariant } from '../dto/upload-image-body.dto';

@Entity('uploaded_images')
export class UploadedImage {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id: string;

  @BeforeInsert()
  generateId() {
    if (!this.id) this.id = uuidv4();
  }

  @Index('idx_uploaded_images_user_id')
  @Column({ type: 'varchar', length: 36, name: 'user_id' })
  userId: string;

  @Index('idx_uploaded_images_profile_id')
  @Column({ type: 'varchar', length: 36, name: 'profile_id', nullable: true })
  profileId: string;

  @Index('idx_uploaded_images_context')
  @Column({ type: 'enum', enum: ImageContext, name: 'context' })
  context: ImageContext;

  @Column({ type: 'text', name: 'image_url' })
  imageUrl: string;

  @Column({ type: 'varchar', length: 255, name: 'image_name', nullable: true })
  imageName: string;

  @Column({ type: 'int', name: 'image_size', nullable: true, unsigned: true })
  imageSize: number;

  @Column({ type: 'varchar', length: 100, name: 'mime_type', nullable: true })
  mimeType: string;

  @Column({ type: 'text', name: 'display_url', nullable: true  })
  displayUrl: string;

  @Column({ type: 'text', name: 'thumbnail_url', nullable: true  })
  thumbnailUrl: string;

  @Column({ type: 'text', name: 'image_variant', nullable: true  })
  imageVariant: UploadedVariant[];

  @Column({ type: 'boolean', name: 'is_deleted', default: false })
  isDeleted: boolean;

  @Column({ type: 'datetime', name: 'deleted_at', nullable: true })
  deletedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
