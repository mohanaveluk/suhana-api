import {
  BadRequestException, Injectable, InternalServerErrorException,
  NotFoundException, PayloadTooLargeException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomBytes } from 'crypto';

import { MediaFile } from './entity/media-file.entity';
import { MediaContext, StorageProvider } from './enums/media-context.enum';
import { AudioMetadataService } from './audio-metadata.service';
import { AudioProcessingService } from './audio-processing.service';
import {
  UploadVoiceResponseDto, VoiceUploadItemDto, VoiceUploadListResponseDto,
} from './dto/voice-upload.dto';
import {
  ALLOWED_AUDIO_EXTENSIONS, VOICE_MAX_DURATION_SECONDS, VOICE_MAX_FILE_SIZE_BYTES,
  containerFromExtension, containerFromMime, isAllowedAudioExtension, isAllowedAudioMime,
} from './config/audio.config';

import { CloudStorageService } from 'src/common/services/cloud-storage.service';
import { User } from '../user/entity';
import { CustomLoggerService } from '../logger/custom-logger.service';

@Injectable()
export class VoiceUploadService {
  private static readonly FOLDER_ROOT = 'matrimony/voice-introduction';

  constructor(
    @InjectRepository(MediaFile)
    private readonly mediaRepo: Repository<MediaFile>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly cloudStorageService: CloudStorageService,
    private readonly audioMetadata: AudioMetadataService,
    private readonly audioProcessing: AudioProcessingService,
    private readonly logger: CustomLoggerService,
  ) {}

  /**
   * Validate → (optionally normalise) → upload to GCS → record history.
   *
   * Deliberately does NOT touch the profile. The caller receives the URL and
   * decides whether to persist it, so a failed profile save can never leave a
   * dangling reference and re-recording never destroys the previous take.
   */
  async uploadVoiceIntroduction(
    userId: string,
    file: Express.Multer.File,
    context: MediaContext,
  ): Promise<UploadVoiceResponseDto> {
    // ── 1. Validate the file itself, before any I/O ──────────────────────────
    const { container, extension } = this.validateAudioFile(file);

    // ── 2. Resolve the owning profile ────────────────────────────────────────
    const user = await this.userRepo.findOne({
      where: { id: userId },
      relations: ['profile'],
    });
    if (!user) throw new NotFoundException('User not found');
    if (!user.profile) throw new NotFoundException('Profile not found');

    // ── 3. Duration, read from the container header ──────────────────────────
    const rawDuration = this.audioMetadata.getDurationSeconds(file.buffer, container);

    if (rawDuration === null) {
      // Unreadable headers mean the bytes do not match the declared format —
      // accepting it would mean skipping the duration limit entirely.
      throw new BadRequestException(
        'Unable to read the audio duration. The file may be corrupted or not a ' +
        'valid audio recording. Please re-record and try again.',
      );
    }

    if (rawDuration <= 0) {
      throw new BadRequestException('The audio file appears to be empty.');
    }

    // Round to whole seconds only after the limit check, so 30.4s still fails.
    if (rawDuration > VOICE_MAX_DURATION_SECONDS) {
      throw new BadRequestException(
        `Voice introduction must not exceed ${VOICE_MAX_DURATION_SECONDS} seconds.`,
      );
    }
    const durationSeconds = Math.max(1, Math.round(rawDuration));

    // ── 4. Optional ffmpeg normalisation (no-op when ffmpeg is absent) ────────
    const processed = await this.audioProcessing.normalise(
      file.buffer,
      file.mimetype,
      extension,
    );

    // ── 5. Upload ────────────────────────────────────────────────────────────
    const folder = `${VoiceUploadService.FOLDER_ROOT}/${user.profile.id}`;
    const fileName = this.buildFileName(processed.extension);

    let uploaded: Awaited<ReturnType<CloudStorageService['uploadVoiceFile']>>;
    try {
      uploaded = await this.cloudStorageService.uploadVoiceFile(
        {
          ...file,
          buffer: processed.buffer,
          size: processed.buffer.length,
          mimetype: processed.mimeType,
        },
        folder,
        fileName,
      );
    } catch (error: any) {
      this.logger.error(
        `Voice upload to GCS failed for user ${userId}: ${error?.message}`,
        error?.stack,
      );
      throw new InternalServerErrorException(
        'Unable to upload voice introduction. Please try again.',
      );
    }

    // ── 6. History record ────────────────────────────────────────────────────
    try {
      const saved = await this.mediaRepo.save(
        this.mediaRepo.create({
          userId,
          profileId: user.profile.id,
          context: MediaContext.VOICE_INTRODUCTION,
          fileName: uploaded.fileName,
          originalFileName: file.originalname ?? null,
          mimeType: uploaded.mimeType,
          fileExtension: processed.extension,
          fileSize: uploaded.size,
          durationSeconds,
          storageProvider: StorageProvider.GCS,
          bucketName: uploaded.bucket,
          folderPath: uploaded.folder,
          publicUrl: uploaded.url,
          isDeleted: false,
          createdBy: userId,
        }),
      );

      return {
        success: true,
        message: 'Voice introduction uploaded successfully.',
        data: this.toItemDto(saved, processed.normalised),
      };
    } catch (error: any) {
      // The object is already in GCS at this point. Surface the failure rather
      // than pretending it worked — the client must not save a URL we did not
      // record. The orphaned object is harmless and cheap.
      this.logger.error(
        `Voice upload succeeded but history insert failed for user ${userId} ` +
        `(orphaned object: ${uploaded.url}): ${error?.message}`,
        error?.stack,
      );
      throw new InternalServerErrorException(
        'Unable to upload voice introduction. Please try again.',
      );
    }
  }

  /** Voice introductions uploaded by this user, newest first. */
  async getMyVoiceIntroductions(userId: string): Promise<VoiceUploadListResponseDto> {
    const rows = await this.mediaRepo.find({
      where: {
        userId,
        context: MediaContext.VOICE_INTRODUCTION,
        isDeleted: false,
      },
      order: { createdAt: 'DESC' },
    });

    return {
      success: true,
      message: 'Voice introductions fetched successfully.',
      data: rows.map((r) => this.toItemDto(r)),
      total: rows.length,
    };
  }

  /** Soft-delete a voice record. The GCS object is intentionally retained. */
  async deleteVoiceIntroduction(
    id: string,
    userId: string,
  ): Promise<{ success: boolean; message: string }> {
    const row = await this.mediaRepo.findOne({
      where: {
        id,
        userId,
        context: MediaContext.VOICE_INTRODUCTION,
        isDeleted: false,
      },
    });
    if (!row) throw new NotFoundException('Voice introduction not found');

    row.isDeleted = true;
    row.deletedAt = new Date();
    await this.mediaRepo.save(row);

    return { success: true, message: 'Voice introduction deleted successfully.' };
  }

  /**
   * Looks up one of *this user's own* voice uploads by its public URL.
   *
   * Used before attaching a URL to a profile: the caller must not be able to
   * point their profile at another member's recording, or at an arbitrary
   * external host, just by sending a different string. Returns null when the URL
   * is not a live upload belonging to this user.
   */
  async findOwnedVoiceByUrl(userId: string, url: string): Promise<MediaFile | null> {
    if (!url) return null;

    return this.mediaRepo.findOne({
      where: {
        userId,
        publicUrl: url,
        context: MediaContext.VOICE_INTRODUCTION,
        isDeleted: false,
      },
    });
  }

  // ---------------------------------------------------------------------------
  // Validation
  // ---------------------------------------------------------------------------

  /**
   * Rejects anything that is not a genuine audio file of an accepted format.
   *
   * Three independent checks, all of which must agree:
   *   1. extension is on the allow-list
   *   2. declared MIME type is on the allow-list
   *   3. the actual magic bytes identify the same container family
   *
   * Check 3 is what stops an executable, image or video renamed to `.mp3` with a
   * spoofed Content-Type — neither the extension nor the header alone is trusted.
   */
  private validateAudioFile(file: Express.Multer.File) {
    if (!file || !file.buffer) {
      throw new BadRequestException('No audio file was provided.');
    }
    if (file.buffer.length === 0 || file.size === 0) {
      throw new BadRequestException('The uploaded file is empty.');
    }

    if (file.size > VOICE_MAX_FILE_SIZE_BYTES) {
      throw new PayloadTooLargeException(
        `Voice introduction must not exceed ` +
        `${VOICE_MAX_FILE_SIZE_BYTES / (1024 * 1024)} MB.`,
      );
    }

    const extension = this.extractExtension(file.originalname);
    if (!extension || !isAllowedAudioExtension(extension)) {
      throw new BadRequestException(
        `Unsupported audio format. Accepted formats: ${ALLOWED_AUDIO_EXTENSIONS.join(', ')}.`,
      );
    }

    if (!isAllowedAudioMime(file.mimetype)) {
      throw new BadRequestException('Unsupported audio format.');
    }

    const declared = containerFromMime(file.mimetype) ?? containerFromExtension(extension);
    if (!declared) {
      throw new BadRequestException('Unsupported audio format.');
    }

    // Content sniffing — the authoritative check.
    const actual = this.audioMetadata.sniffContainer(file.buffer);
    if (actual === null) {
      throw new BadRequestException(
        'The uploaded file is not a recognised audio file.',
      );
    }

    // MP4 and raw-ADTS both legitimately answer to audio/aac and .m4a depending
    // on the encoder, so treat that one pair as interchangeable. Everything else
    // must match exactly.
    const compatible =
      actual === declared ||
      (declared === 'mp4' && actual === 'adts') ||
      (declared === 'adts' && actual === 'mp4');

    if (!compatible) {
      throw new BadRequestException(
        'The file contents do not match its audio format. Please upload a valid audio file.',
      );
    }

    return { container: actual, extension };
  }

  private extractExtension(originalName?: string): string | null {
    if (!originalName) return null;
    const match = originalName.toLowerCase().match(/\.([a-z0-9]+)$/);
    return match ? match[1] : null;
  }

  /**
   * `voice-YYYYMMDD-HHMMSS-<6 hex>.<ext>`
   *
   * The random suffix is required, not cosmetic: two uploads inside the same
   * second would otherwise collide, and uploads must never overwrite each other.
   */
  private buildFileName(extension: string): string {
    const now = new Date();
    const p = (n: number, width = 2) => String(n).padStart(width, '0');

    const stamp =
      `${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}` +
      `-${p(now.getHours())}${p(now.getMinutes())}${p(now.getSeconds())}`;

    return `voice-${stamp}-${randomBytes(3).toString('hex')}.${extension}`;
  }

  // ---------------------------------------------------------------------------

  private toItemDto(media: MediaFile, normalised = false): VoiceUploadItemDto {
    return {
      id: media.id,
      guid: media.guid,
      audioUrl: media.publicUrl,
      durationSeconds: media.durationSeconds,
      mimeType: media.mimeType,
      fileSize: media.fileSize,
      fileName: media.fileName,
      originalFileName: media.originalFileName,
      context: media.context,
      folderPath: media.folderPath,
      bucketName: media.bucketName,
      normalised,
      uploadedAt: media.createdAt,
    };
  }
}
