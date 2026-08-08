import { Injectable } from '@nestjs/common';
import { execFile, spawn } from 'child_process';
import { promisify } from 'util';
import { CustomLoggerService } from '../logger/custom-logger.service';
import { VOICE_NORMALISE_TARGET } from './config/audio.config';

const execFileAsync = promisify(execFile);

export interface NormalisedAudio {
  buffer: Buffer;
  mimeType: string;
  extension: string;
  normalised: boolean;
}

/**
 * Optional audio normalisation via ffmpeg.
 *
 * ffmpeg is NOT a project dependency and is not installed in the production
 * image (Dockerfile.prod is node:22-alpine with no ffmpeg layer), so its presence
 * is probed once at runtime and cached. When it is missing — the expected case in
 * production today — `normalise()` returns the original bytes untouched, which is
 * the documented fallback.
 *
 * To enable normalisation in production, add `RUN apk add --no-cache ffmpeg` to
 * the runtime stage of Dockerfile.prod. No code change is needed.
 */
@Injectable()
export class AudioProcessingService {
  private ffmpegAvailable: boolean | null = null;

  // Guard against a hung subprocess holding a request open.
  private static readonly FFMPEG_TIMEOUT_MS = 20_000;

  constructor(private readonly logger: CustomLoggerService) {}

  /** Probes for an ffmpeg binary once; the result is cached for the process. */
  async isFfmpegAvailable(): Promise<boolean> {
    if (this.ffmpegAvailable !== null) return this.ffmpegAvailable;

    try {
      await execFileAsync('ffmpeg', ['-version'], { timeout: 5_000 });
      this.ffmpegAvailable = true;
      this.logger.log('ffmpeg detected — voice uploads will be normalised');
    } catch {
      this.ffmpegAvailable = false;
      this.logger.log('ffmpeg not available — voice uploads will be stored as received');
    }
    return this.ffmpegAvailable;
  }

  /**
   * Re-encodes to mono / 64 kbps / 22.05 kHz mp3 when ffmpeg is present.
   * Returns the input unchanged (normalised: false) when it is not, or when the
   * encode fails — a normalisation failure must never fail the upload.
   */
  async normalise(
    buffer: Buffer,
    sourceMimeType: string,
    sourceExtension: string,
  ): Promise<NormalisedAudio> {
    const untouched: NormalisedAudio = {
      buffer,
      mimeType: sourceMimeType,
      extension: sourceExtension,
      normalised: false,
    };

    if (!(await this.isFfmpegAvailable())) return untouched;

    try {
      const output = await this.runFfmpeg(buffer);

      // A zero-length or absurdly small result means the encode silently failed.
      if (!output?.length || output.length < 128) {
        this.logger.warn('ffmpeg produced an empty result — storing original audio');
        return untouched;
      }

      return {
        buffer: output,
        mimeType: VOICE_NORMALISE_TARGET.mimeType,
        extension: VOICE_NORMALISE_TARGET.extension,
        normalised: true,
      };
    } catch (error: any) {
      this.logger.warn(
        `ffmpeg normalisation failed, storing original audio: ${error?.message}`,
      );
      return untouched;
    }
  }

  /**
   * Pipes the buffer through ffmpeg via stdin/stdout so nothing touches disk —
   * important on Cloud Run, where the filesystem is in-memory.
   */
  private runFfmpeg(input: Buffer): Promise<Buffer> {
    const { channels, bitrate, sampleRate, format } = VOICE_NORMALISE_TARGET;

    const args = [
      '-hide_banner',
      '-loglevel', 'error',
      '-i', 'pipe:0',
      '-vn',                        // drop any cover art / video stream
      '-map_metadata', '-1',        // strip tags (may carry PII)
      '-ac', String(channels),
      '-ar', String(sampleRate),
      '-b:a', bitrate,
      '-codec:a', 'libmp3lame',
      '-f', format,
      'pipe:1',
    ];

    return new Promise<Buffer>((resolve, reject) => {
      const child = spawn('ffmpeg', args, { stdio: ['pipe', 'pipe', 'pipe'] });

      const stdout: Buffer[] = [];
      let stderr = '';
      let settled = false;

      const finish = (err: Error | null, value?: Buffer) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        err ? reject(err) : resolve(value!);
      };

      const timer = setTimeout(() => {
        child.kill('SIGKILL');
        finish(new Error('ffmpeg timed out'));
      }, AudioProcessingService.FFMPEG_TIMEOUT_MS);

      child.stdout.on('data', (chunk: Buffer) => stdout.push(chunk));
      child.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });

      child.on('error', (err) => finish(err));
      child.on('close', (code) => {
        if (code === 0) finish(null, Buffer.concat(stdout));
        else finish(new Error(`ffmpeg exited with code ${code}: ${stderr.trim()}`));
      });

      // EPIPE fires if ffmpeg rejects the input before reading it all; the close
      // handler reports the real reason, so swallow it here.
      child.stdin.on('error', () => undefined);
      child.stdin.end(input);
    });
  }
}
