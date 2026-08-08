import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Body for attaching an already-uploaded voice introduction to the profile.
 *
 * The URL must come from POST /profile/voice/upload — the service verifies it
 * against the caller's own media_file history rather than trusting the string,
 * so a member cannot point their profile at someone else's recording or at an
 * arbitrary external host.
 */
export class SetVoiceIntroductionDto {
  @ApiProperty({
    example:
      'https://storage.googleapis.com/inv-images/matrimony/voice-introduction/p123/voice-20260806-143522-a1b2c3.mp3',
    description: 'Public URL returned by POST /profile/voice/upload',
  })
  @IsNotEmpty()
  @IsString()
  @MaxLength(500)
  voiceIntroductionUrl: string;
}

export class VoiceIntroductionResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 'Voice introduction saved successfully.' })
  message: string;

  @ApiProperty({
    example: {
      profileId: 'p123',
      voiceIntroductionUrl:
        'https://storage.googleapis.com/inv-images/matrimony/voice-introduction/p123/voice-20260806-143522-a1b2c3.mp3',
      durationSeconds: 23,
    },
  })
  data: {
    profileId: string;
    voiceIntroductionUrl: string | null;
    durationSeconds?: number | null;
  };
}
