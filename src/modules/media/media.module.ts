import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { MediaFile } from './entity/media-file.entity';
import { VoiceUploadController } from './voice-upload.controller';
import { VoiceUploadService } from './voice-upload.service';
import { AudioMetadataService } from './audio-metadata.service';
import { AudioProcessingService } from './audio-processing.service';
import { CloudStorageService } from 'src/common/services/cloud-storage.service';
import { User } from '../user/entity';
import { LogModule } from '../logger/log.module';

// Non-image media uploads. Voice introductions today; the MediaContext enum and
// the media_file table are shaped to take chat audio, video introductions and
// documents without a schema change.
@Module({
  imports: [TypeOrmModule.forFeature([MediaFile, User]), LogModule],
  controllers: [VoiceUploadController],
  providers: [
    VoiceUploadService,
    AudioMetadataService,
    AudioProcessingService,
    CloudStorageService,
  ],
  exports: [VoiceUploadService, AudioMetadataService],
})
export class MediaModule {}
