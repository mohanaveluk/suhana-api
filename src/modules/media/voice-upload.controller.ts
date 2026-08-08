import {
  Body,
  Controller, Delete, Get, Param, Post, Request,
  UploadedFile, UseGuards, UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation,
  ApiParam, ApiResponse, ApiTags,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';

import { VoiceUploadService } from './voice-upload.service';
import {
  UploadVoiceBodyDto, UploadVoiceResponseDto, VoiceUploadListResponseDto,
} from './dto/voice-upload.dto';
import {
  ALLOWED_AUDIO_EXTENSIONS, VOICE_MAX_DURATION_SECONDS, VOICE_MAX_FILE_SIZE_BYTES,
} from './config/audio.config';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { MediaContext } from './enums/media-context.enum';

@ApiTags('profile / voice')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('profile/voice')
export class VoiceUploadController {
  constructor(private readonly voiceUploadService: VoiceUploadService) {}

  // POST /api/v1/profile/voice/upload
  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      // Coarse backstop only — it aborts a runaway stream early. The exact 5 MB
      // limit is enforced in the service so it can answer with a 413 and a
      // human-readable message.
      limits: { fileSize: VOICE_MAX_FILE_SIZE_BYTES + 1024 * 1024, files: 1 },
    }),
  )
  @ApiOperation({
    summary: 'Upload a voice introduction',
    description:
      `Uploads a voice introduction to Google Cloud Storage under ` +
      `\`matrimony/voice-introduction/{profileId}/\` and records the upload in the media history.\n\n` +
      `**Accepted formats:** ${ALLOWED_AUDIO_EXTENSIONS.join(', ')}\n` +
      `**Limits:** ${VOICE_MAX_FILE_SIZE_BYTES / (1024 * 1024)} MB, ` +
      `${VOICE_MAX_DURATION_SECONDS} seconds\n\n` +
      `Duration is measured from the audio container header, and the file's magic bytes ` +
      `must match its declared format — a renamed executable, image or video is rejected.\n\n` +
      `When an ffmpeg binary is available the audio is normalised to mono / 64 kbps / 22.05 kHz mp3; ` +
      `otherwise the original is stored unchanged. The \`normalised\` flag reports which happened.\n\n` +
      `**This endpoint does not modify the profile.** It returns the URL so the client can save it.`,
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: UploadVoiceBodyDto })
  @ApiResponse({
    status: 201,
    description: 'Voice introduction uploaded successfully',
    type: UploadVoiceResponseDto,
  })
  @ApiResponse({
    status: 400,
    description:
      'No file, empty file, unsupported audio format, contents not matching the declared format, ' +
      'unreadable audio, or duration above the 30-second limit',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized — missing or invalid JWT' })
  @ApiResponse({ status: 404, description: 'User or profile not found' })
  @ApiResponse({ status: 413, description: 'File exceeds the 5 MB limit' })
  @ApiResponse({ status: 500, description: 'Upload to storage failed — safe to retry' })
  uploadVoiceIntroduction(
    @Request() req: any,
    @UploadedFile() file: Express.Multer.File,
    @Body('context') context: MediaContext,
  ): Promise<UploadVoiceResponseDto> {
    return this.voiceUploadService.uploadVoiceIntroduction(req.user.id, file, context);
  }

  // GET /api/v1/profile/voice/my
  @Get('my')
  @ApiOperation({
    summary: 'List my uploaded voice introductions',
    description:
      'Returns every voice introduction uploaded by the authenticated user, newest first. ' +
      'Previous recordings are retained, so this doubles as the re-record history.',
  })
  @ApiResponse({ status: 200, description: 'List of uploads', type: VoiceUploadListResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized — missing or invalid JWT' })
  getMyVoiceIntroductions(@Request() req: any): Promise<VoiceUploadListResponseDto> {
    return this.voiceUploadService.getMyVoiceIntroductions(req.user.id);
  }

  // DELETE /api/v1/profile/voice/:id
  @Delete(':id')
  @ApiOperation({
    summary: 'Soft-delete a voice introduction record',
    description: 'Marks the record deleted. The stored object in GCS is retained.',
  })
  @ApiParam({ name: 'id', description: 'Media record UUID' })
  @ApiResponse({ status: 200, description: 'Record soft-deleted' })
  @ApiResponse({ status: 401, description: 'Unauthorized — missing or invalid JWT' })
  @ApiResponse({ status: 404, description: 'Record not found or does not belong to you' })
  deleteVoiceIntroduction(
    @Request() req: any,
    @Param('id') id: string,
  ): Promise<{ success: boolean; message: string }> {
    return this.voiceUploadService.deleteVoiceIntroduction(id, req.user.id);
  }
}
