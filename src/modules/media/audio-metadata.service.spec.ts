import { execFileSync } from 'child_process';
import { mkdtempSync, readFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

import { AudioMetadataService } from './audio-metadata.service';
import { AudioContainer } from './config/audio.config';

/**
 * Duration parsing is validated against real encoder output rather than
 * hand-built byte fixtures — the whole point of these parsers is to survive what
 * actual encoders emit (ID3 tags, LIST chunks, Xing headers, EBML nesting).
 *
 * Fixtures are generated with ffmpeg at test time. Where ffmpeg is unavailable
 * (CI, the production image) the encoder-dependent tests are skipped; the pure
 * rejection tests below always run.
 */
const hasFfmpeg = (() => {
  try {
    execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
})();

const describeWithFfmpeg = hasFfmpeg ? describe : describe.skip;

describe('AudioMetadataService', () => {
  const service = new AudioMetadataService();

  describeWithFfmpeg('duration parsing (real encoder output)', () => {
    let dir: string;

    // Encoding six formats at three lengths takes a few seconds.
    jest.setTimeout(120_000);

    const durations = [3, 12, 35];

    beforeAll(() => {
      dir = mkdtempSync(join(tmpdir(), 'suhana-audio-'));

      const run = (args: string[]) =>
        execFileSync('ffmpeg', ['-v', 'error', ...args, '-y'], { stdio: 'ignore' });

      for (const d of durations) {
        const wav = join(dir, `t${d}.wav`);
        run(['-f', 'lavfi', '-i', `sine=frequency=440:duration=${d}`, '-ac', '1', '-ar', '44100', wav]);
        run(['-i', wav, '-codec:a', 'libmp3lame', '-b:a', '64k', join(dir, `t${d}.mp3`)]);
        run(['-i', wav, '-codec:a', 'aac', '-b:a', '64k', join(dir, `t${d}.m4a`)]);
        run(['-i', wav, '-codec:a', 'libvorbis', join(dir, `t${d}.ogg`)]);
        run(['-i', wav, '-codec:a', 'libopus', join(dir, `t${d}.webm`)]);
        run(['-i', wav, '-codec:a', 'aac', '-b:a', '64k', '-f', 'adts', join(dir, `t${d}.aac`)]);
      }

      // VBR mp3 exercises the Xing frame-count path rather than the CBR fallback.
      run(['-i', join(dir, 't12.wav'), '-codec:a', 'libmp3lame', '-q:a', '5', join(dir, 't12vbr.mp3')]);
    });

    afterAll(() => {
      if (dir) rmSync(dir, { recursive: true, force: true });
    });

    const cases: Array<[string, AudioContainer]> = [
      ['wav', AudioContainer.WAV],
      ['mp3', AudioContainer.MP3],
      ['m4a', AudioContainer.MP4],
      ['ogg', AudioContainer.OGG],
      ['webm', AudioContainer.WEBM],
      ['aac', AudioContainer.ADTS],
    ];

    describe.each(cases)('%s', (ext, container) => {
      it.each(durations)('reads a %ss recording within 0.6s', (expected) => {
        const buf = readFileSync(join(dir, `t${expected}.${ext}`));
        const actual = service.getDurationSeconds(buf, container);

        expect(actual).not.toBeNull();
        expect(Math.abs(actual! - expected)).toBeLessThan(0.6);
      });

      it.each(durations)('sniffs the container of a %ss recording', (expected) => {
        const buf = readFileSync(join(dir, `t${expected}.${ext}`));
        const sniffed = service.sniffContainer(buf);

        // AAC-in-MP4 and raw ADTS are mutually substitutable by design.
        const acceptable =
          container === AudioContainer.MP4 || container === AudioContainer.ADTS
            ? [AudioContainer.MP4, AudioContainer.ADTS]
            : [container];

        expect(acceptable).toContain(sniffed);
      });
    });

    it('reads VBR mp3 via the Xing frame count', () => {
      const buf = readFileSync(join(dir, 't12vbr.mp3'));
      const actual = service.getDurationSeconds(buf, AudioContainer.MP3);

      expect(actual).not.toBeNull();
      expect(Math.abs(actual! - 12)).toBeLessThan(0.6);
    });

    it('correctly identifies a 35s file as over the 30s limit', () => {
      const buf = readFileSync(join(dir, 't35.mp3'));
      expect(service.getDurationSeconds(buf, AudioContainer.MP3)!).toBeGreaterThan(30);
    });

    it('correctly identifies a 12s file as within the 30s limit', () => {
      const buf = readFileSync(join(dir, 't12.mp3'));
      expect(service.getDurationSeconds(buf, AudioContainer.MP3)!).toBeLessThan(30);
    });
  });

  describe('rejection of non-audio input', () => {
    it('returns null for an empty buffer', () => {
      expect(service.getDurationSeconds(Buffer.alloc(0), AudioContainer.MP3)).toBeNull();
    });

    it('returns null for random bytes', () => {
      const junk = Buffer.from(Array.from({ length: 4096 }, (_, i) => (i * 37) % 251));
      for (const c of Object.values(AudioContainer)) {
        expect(service.getDurationSeconds(junk, c)).toBeNull();
      }
    });

    it('does not sniff a Windows executable as audio', () => {
      const exe = Buffer.concat([
        Buffer.from('MZ'),                  // DOS header magic
        Buffer.alloc(1024, 0x00),
      ]);
      expect(service.sniffContainer(exe)).toBeNull();
    });

    it('does not sniff a PNG as audio', () => {
      const png = Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        Buffer.alloc(512, 0x00),
      ]);
      expect(service.sniffContainer(png)).toBeNull();
    });

    it('does not sniff a JPEG as audio', () => {
      // JPEG starts FF D8 FF — close to an MPEG sync (FF Ex) but must not match.
      const jpeg = Buffer.concat([
        Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
        Buffer.alloc(512, 0x00),
      ]);
      expect(service.sniffContainer(jpeg)).toBeNull();
    });

    it('returns null for a truncated WAV header', () => {
      const truncated = Buffer.from('RIFF');
      expect(service.getDurationSeconds(truncated, AudioContainer.WAV)).toBeNull();
    });

    it('returns null for a RIFF container that is not WAVE', () => {
      const avi = Buffer.concat([
        Buffer.from('RIFF'),
        Buffer.from([0x00, 0x00, 0x00, 0x00]),
        Buffer.from('AVI '),
        Buffer.alloc(64, 0),
      ]);
      expect(service.getDurationSeconds(avi, AudioContainer.WAV)).toBeNull();
    });
  });
});
