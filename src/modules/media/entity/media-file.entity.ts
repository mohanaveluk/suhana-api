import {
  Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn,
  BeforeInsert, Index,
} from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { MediaContext, StorageProvider } from '../enums/media-context.enum';

/**
 * Upload history for non-image media assets.
 *
 * One row per successful upload, never updated in place — re-uploading a voice
 * introduction inserts a new row so the history stays intact and the previous
 * object in GCS is never overwritten.
 *
 * Kept separate from `uploaded_images`: that table is image-shaped (display and
 * thumbnail variant URLs, no duration) and its `context` column is an enum of
 * image placements. Mixing voice notes into it would mean nullable variant
 * columns on every image row and a context enum meaning two different things.
 */
@Entity('media_file')
@Index('IDX_MEDIA_USER_CONTEXT', ['userId', 'context'])
@Index('IDX_MEDIA_PROFILE_CONTEXT', ['profileId', 'context'])
@Index('IDX_MEDIA_CONTEXT_CREATED', ['context', 'createdAt'])
export class MediaFile {
  @PrimaryColumn({ type: 'varchar', length: 36 })
  id: string;

  @Column({ type: 'varchar', length: 36 })
  guid: string;

  // Matches the id-generation style used by UploadedImage.
  @BeforeInsert()
  generateIds() {
    if (!this.id) this.id = uuidv4();
    if (!this.guid) this.guid = uuidv4();
  }

  @Column({ type: 'varchar', length: 36, name: 'user_id' })
  userId: string;

  @Column({ type: 'varchar', length: 36, name: 'profile_id', nullable: true })
  profileId: string | null;

  @Column({ type: 'varchar', length: 40, name: 'context' })
  context: MediaContext;

  // Object name as stored in the bucket, e.g. voice-20260806-143522-a1b2c3.mp3
  @Column({ type: 'varchar', length: 255, name: 'file_name' })
  fileName: string;

  // What the client called it before upload — kept for support/debugging only.
  @Column({ type: 'varchar', length: 255, name: 'original_file_name', nullable: true })
  originalFileName: string | null;

  @Column({ type: 'varchar', length: 100, name: 'mime_type', nullable: true })
  mimeType: string | null;

  @Column({ type: 'varchar', length: 20, name: 'file_extension', nullable: true })
  fileExtension: string | null;

  @Column({ type: 'int', name: 'file_size', unsigned: true, nullable: true })
  fileSize: number | null;

  // Audio/video only. Null for media where duration is not meaningful.
  @Column({ type: 'int', name: 'duration_seconds', unsigned: true, nullable: true })
  durationSeconds: number | null;

  @Column({ type: 'varchar', length: 20, name: 'storage_provider', default: StorageProvider.GCS })
  storageProvider: StorageProvider;

  @Column({ type: 'varchar', length: 255, name: 'bucket_name', nullable: true })
  bucketName: string | null;

  // Folder prefix inside the bucket, e.g. matrimony/voice-introduction/p123
  @Column({ type: 'varchar', length: 500, name: 'folder_path', nullable: true })
  folderPath: string | null;

  @Column({ type: 'text', name: 'public_url' })
  publicUrl: string;

  @Column({ type: 'boolean', name: 'is_deleted', default: false })
  isDeleted: boolean;

  @Column({ type: 'datetime', name: 'deleted_at', nullable: true })
  deletedAt: Date | null;

  @Column({ type: 'varchar', length: 36, name: 'created_by', nullable: true })
  createdBy: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
