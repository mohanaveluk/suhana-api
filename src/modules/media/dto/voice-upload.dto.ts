import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MediaContext } from '../enums/media-context.enum';
import {
  ALLOWED_AUDIO_EXTENSIONS, VOICE_MAX_DURATION_SECONDS,
} from '../config/audio.config';

/** multipart/form-data body — declared so Swagger renders a file picker. */
export class UploadVoiceBodyDto {
  @ApiProperty({
    type: 'string',
    format: 'binary',
    description:
      `Audio file to upload. Accepted: ${ALLOWED_AUDIO_EXTENSIONS.join(', ')}. ` +
      `Max 5 MB and ${VOICE_MAX_DURATION_SECONDS} seconds.`,
  })
  file: any;
}

/** The stored media record, as returned to the caller. */
export class VoiceUploadItemDto {
  @ApiProperty({ example: '9f1c2b7e-4d3a-4c8e-9a1b-2f6d5e8c7a90' })
  id: string;

  @ApiProperty({ example: 'b3d8e1a2-7c45-4f92-8e0d-1a2b3c4d5e6f' })
  guid: string;

  @ApiProperty({
    example:
      'https://storage.googleapis.com/inv-images/matrimony/voice-introduction/p123/voice-20260806-143522-a1b2c3.mp3',
    description: 'Public URL of the uploaded audio. Save this to the profile from the client.',
  })
  audioUrl: string;

  @ApiPropertyOptional({
    example: 23,
    description: 'Measured duration in whole seconds, read from the audio container header.',
  })
  durationSeconds: number | null;

  @ApiProperty({ example: 'audio/mpeg' })
  mimeType: string;

  @ApiProperty({ example: 452318, description: 'Stored size in bytes (after normalisation, if applied)' })
  fileSize: number;

  @ApiProperty({ example: 'voice-20260806-143522-a1b2c3.mp3', description: 'Object name inside the bucket' })
  fileName: string;

  @ApiPropertyOptional({ example: 'voice.mp3' })
  originalFileName: string | null;

  @ApiProperty({ enum: MediaContext, example: MediaContext.VOICE_INTRODUCTION })
  context: MediaContext;

  @ApiPropertyOptional({ example: 'matrimony/voice-introduction/p123' })
  folderPath: string | null;

  @ApiPropertyOptional({ example: 'inv-images' })
  bucketName: string | null;

  @ApiProperty({
    example: false,
    description: 'True when ffmpeg was available and the audio was re-encoded to mono 64 kbps 22.05 kHz mp3.',
  })
  normalised: boolean;

  @ApiProperty({ example: '2026-08-06T18:30:22.000Z' })
  uploadedAt: Date;
}

export class UploadVoiceResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 'Voice introduction uploaded successfully.' })
  message: string;

  @ApiProperty({ type: VoiceUploadItemDto })
  data: VoiceUploadItemDto;
}

export class VoiceUploadListResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 'Voice introductions fetched successfully.' })
  message: string;

  @ApiProperty({ type: [VoiceUploadItemDto] })
  data: VoiceUploadItemDto[];

  @ApiProperty({ example: 3 })
  total: number;
}
