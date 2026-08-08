import { Injectable } from '@nestjs/common';
import { AudioContainer } from './config/audio.config';

/**
 * Reads audio duration straight from container headers.
 *
 * Why hand-rolled: the project has no audio-metadata dependency, and ffmpeg is
 * not present in the production image (Dockerfile.prod is node:22-alpine with no
 * ffmpeg install), so neither ffprobe nor music-metadata can be relied on at
 * runtime. Duration is a hard validation requirement, so it is parsed here from
 * the bytes we already hold in memory — no subprocess, no temp file, no network.
 *
 * Every parser returns null rather than throwing when the header is malformed or
 * an unexpected variant is hit. The caller decides the policy for "unknown".
 */
@Injectable()
export class AudioMetadataService {
  /**
   * Duration in seconds, or null when it cannot be determined.
   * `container` selects the parser; a wrong guess simply yields null.
   */
  getDurationSeconds(buffer: Buffer, container: AudioContainer): number | null {
    if (!buffer?.length) return null;

    try {
      switch (container) {
        case AudioContainer.WAV:  return this.wavDuration(buffer);
        case AudioContainer.MP3:  return this.mp3Duration(buffer);
        case AudioContainer.MP4:  return this.mp4Duration(buffer);
        case AudioContainer.OGG:  return this.oggDuration(buffer);
        case AudioContainer.WEBM: return this.webmDuration(buffer);
        case AudioContainer.ADTS: return this.adtsDuration(buffer);
        default: return null;
      }
    } catch {
      // A malformed file is a validation problem, not a crash.
      return null;
    }
  }

  /**
   * Sniffs the container from magic bytes, independent of the declared MIME
   * type. Used to catch files whose extension/MIME lie about their contents —
   * an .mp3 that is really a .exe fails here.
   */
  sniffContainer(buffer: Buffer): AudioContainer | null {
    if (!buffer || buffer.length < 12) return null;

    const ascii = (start: number, len: number) =>
      buffer.subarray(start, start + len).toString('binary');

    // RIFF....WAVE
    if (ascii(0, 4) === 'RIFF' && ascii(8, 4) === 'WAVE') return AudioContainer.WAV;

    // OggS
    if (ascii(0, 4) === 'OggS') return AudioContainer.OGG;

    // EBML magic — Matroska / WebM
    if (buffer.readUInt32BE(0) === 0x1a45dfa3) return AudioContainer.WEBM;

    // ISO-BMFF: <size><'ftyp'>
    if (ascii(4, 4) === 'ftyp') return AudioContainer.MP4;

    // ID3v2 tag always precedes mp3 audio in practice
    if (ascii(0, 3) === 'ID3') return AudioContainer.MP3;

    // Bare MPEG audio frame sync (11 set bits)
    if (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0) {
      // ADTS AAC also starts 0xFFF; layer bits are 00 for ADTS, non-zero for mp3.
      const layer = (buffer[1] >> 1) & 0x03;
      return layer === 0 ? AudioContainer.ADTS : AudioContainer.MP3;
    }

    return null;
  }

  // ─── WAV (RIFF) ────────────────────────────────────────────────────────────
  // Walk the chunk list for `fmt ` (byte rate) and `data` (payload size).
  // duration = dataSize / byteRate. Exact for PCM, which is what browsers emit.
  private wavDuration(buf: Buffer): number | null {
    if (buf.length < 12 || buf.toString('binary', 0, 4) !== 'RIFF') return null;
    if (buf.toString('binary', 8, 12) !== 'WAVE') return null;

    let offset = 12;
    let byteRate = 0;
    let sampleRate = 0;
    let channels = 0;
    let bitsPerSample = 0;
    let dataSize = 0;

    while (offset + 8 <= buf.length) {
      const chunkId = buf.toString('binary', offset, offset + 4);
      const chunkSize = buf.readUInt32LE(offset + 4);
      const body = offset + 8;

      if (chunkId === 'fmt ' && body + 16 <= buf.length) {
        channels = buf.readUInt16LE(body + 2);
        sampleRate = buf.readUInt32LE(body + 4);
        byteRate = buf.readUInt32LE(body + 8);
        bitsPerSample = buf.readUInt16LE(body + 14);
      } else if (chunkId === 'data') {
        // Trust the real remaining bytes when the header size is bogus or the
        // file was truncated mid-write (common with streamed recordings).
        const remaining = buf.length - body;
        dataSize = chunkSize > 0 && chunkSize <= remaining ? chunkSize : remaining;
        break;
      }

      // Chunks are word-aligned: odd sizes carry a trailing pad byte.
      offset = body + chunkSize + (chunkSize % 2);
    }

    if (dataSize <= 0) return null;

    if (byteRate > 0) return dataSize / byteRate;

    // Fall back to deriving byte rate when the fmt chunk omitted it.
    if (sampleRate > 0 && channels > 0 && bitsPerSample > 0) {
      return dataSize / (sampleRate * channels * (bitsPerSample / 8));
    }
    return null;
  }

  // ─── MP3 (MPEG audio) ──────────────────────────────────────────────────────
  // Prefer the Xing/Info or VBRI frame count (accurate for VBR); otherwise treat
  // the stream as CBR and divide the payload by the bitrate.
  private mp3Duration(buf: Buffer): number | null {
    const start = this.skipId3(buf);
    const frameOffset = this.findMpegFrameSync(buf, start);
    if (frameOffset === null) return null;

    const header = this.parseMpegHeader(buf, frameOffset);
    if (!header) return null;

    const { sampleRate, bitrate, samplesPerFrame, channelMode, version } = header;

    // Xing/Info sits at a fixed offset after the frame header, depending on
    // MPEG version and whether the stream is mono.
    const sideInfo =
      version === 3 // MPEG-1
        ? (channelMode === 3 ? 17 : 32)
        : (channelMode === 3 ? 9 : 17);
    const tagOffset = frameOffset + 4 + sideInfo;

    if (tagOffset + 12 <= buf.length) {
      const tag = buf.toString('binary', tagOffset, tagOffset + 4);
      if (tag === 'Xing' || tag === 'Info') {
        const flags = buf.readUInt32BE(tagOffset + 4);
        if (flags & 0x0001) {
          const frames = buf.readUInt32BE(tagOffset + 8);
          if (frames > 0 && sampleRate > 0) {
            return (frames * samplesPerFrame) / sampleRate;
          }
        }
      }
    }

    // VBRI (Fraunhofer encoders) lives 32 bytes past the header, always.
    const vbriOffset = frameOffset + 4 + 32;
    if (vbriOffset + 26 <= buf.length &&
        buf.toString('binary', vbriOffset, vbriOffset + 4) === 'VBRI') {
      const frames = buf.readUInt32BE(vbriOffset + 14);
      if (frames > 0 && sampleRate > 0) {
        return (frames * samplesPerFrame) / sampleRate;
      }
    }

    // CBR fallback.
    if (bitrate > 0) {
      const audioBytes = buf.length - frameOffset;
      return (audioBytes * 8) / bitrate;
    }
    return null;
  }

  /** Byte offset of the audio data, skipping any ID3v2 tag. */
  private skipId3(buf: Buffer): number {
    if (buf.length < 10 || buf.toString('binary', 0, 3) !== 'ID3') return 0;

    // Synchsafe integer: 7 significant bits per byte.
    const size =
      ((buf[6] & 0x7f) << 21) |
      ((buf[7] & 0x7f) << 14) |
      ((buf[8] & 0x7f) << 7) |
      (buf[9] & 0x7f);

    const hasFooter = (buf[5] & 0x10) !== 0;
    return Math.min(10 + size + (hasFooter ? 10 : 0), buf.length);
  }

  /** First plausible MPEG frame sync at or after `from`. */
  private findMpegFrameSync(buf: Buffer, from: number): number | null {
    // Cap the scan — a valid frame appears almost immediately; scanning further
    // means the file is not really mp3.
    const limit = Math.min(buf.length - 4, from + 64 * 1024);
    for (let i = from; i <= limit; i++) {
      if (buf[i] === 0xff && (buf[i + 1] & 0xe0) === 0xe0) {
        if (this.parseMpegHeader(buf, i)) return i;
      }
    }
    return null;
  }

  private parseMpegHeader(buf: Buffer, offset: number): {
    sampleRate: number;
    bitrate: number;
    samplesPerFrame: number;
    channelMode: number;
    version: number;
  } | null {
    if (offset + 4 > buf.length) return null;

    const b1 = buf[offset + 1];
    const b2 = buf[offset + 2];
    const b3 = buf[offset + 3];

    const version = (b1 >> 3) & 0x03;      // 3 = MPEG-1, 2 = MPEG-2, 0 = MPEG-2.5
    const layer = (b1 >> 1) & 0x03;        // 1 = Layer III
    const bitrateIndex = (b2 >> 4) & 0x0f;
    const sampleRateIndex = (b2 >> 2) & 0x03;
    const channelMode = (b3 >> 6) & 0x03;  // 3 = mono

    if (version === 1 || layer === 0) return null;             // reserved
    if (bitrateIndex === 0 || bitrateIndex === 0x0f) return null; // free/bad
    if (sampleRateIndex === 3) return null;                    // reserved

    const SAMPLE_RATES: Record<number, number[]> = {
      3: [44100, 48000, 32000], // MPEG-1
      2: [22050, 24000, 16000], // MPEG-2
      0: [11025, 12000, 8000],  // MPEG-2.5
    };
    const sampleRate = SAMPLE_RATES[version]?.[sampleRateIndex];
    if (!sampleRate) return null;

    // kbps tables, indexed by bitrateIndex. Layer III only (layer bits === 1).
    const V1_L3 = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320];
    const V2_L3 = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160];
    const V1_L2 = [0, 32, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 384];
    const V1_L1 = [0, 32, 64, 96, 128, 160, 192, 224, 256, 288, 320, 352, 384, 416, 448];
    const V2_L1 = [0, 32, 48, 56, 64, 80, 96, 112, 128, 144, 160, 176, 192, 224, 256];

    let table: number[];
    if (version === 3) {
      table = layer === 1 ? V1_L3 : layer === 2 ? V1_L2 : V1_L1;
    } else {
      table = layer === 3 ? V2_L1 : V2_L3;
    }
    const bitrate = (table[bitrateIndex] ?? 0) * 1000;
    if (!bitrate) return null;

    // Layer I is 384 samples/frame; Layer II is 1152; Layer III is 1152 on
    // MPEG-1 but 576 on MPEG-2/2.5.
    let samplesPerFrame: number;
    if (layer === 3) samplesPerFrame = 384;
    else if (layer === 2) samplesPerFrame = 1152;
    else samplesPerFrame = version === 3 ? 1152 : 576;

    return { sampleRate, bitrate, samplesPerFrame, channelMode, version };
  }

  // ─── MP4 / M4A (ISO-BMFF) ──────────────────────────────────────────────────
  // moov > mvhd carries timescale + duration. duration / timescale = seconds.
  private mp4Duration(buf: Buffer): number | null {
    const mvhd = this.findAtom(buf, 0, buf.length, ['moov', 'mvhd']);
    if (mvhd === null) return null;

    // Atom body starts 8 bytes in (size + type).
    const body = mvhd + 8;
    if (body + 4 > buf.length) return null;

    const version = buf[body];
    let timescale: number;
    let duration: number;

    if (version === 1) {
      // 8-byte creation + 8-byte modification + 4-byte timescale + 8-byte duration
      if (body + 4 + 8 + 8 + 4 + 8 > buf.length) return null;
      timescale = buf.readUInt32BE(body + 4 + 16);
      // Read as two 32-bit halves — durations here are far below 2^53.
      const hi = buf.readUInt32BE(body + 4 + 20);
      const lo = buf.readUInt32BE(body + 4 + 24);
      duration = hi * 2 ** 32 + lo;
    } else {
      // 4-byte creation + 4-byte modification + 4-byte timescale + 4-byte duration
      if (body + 4 + 4 + 4 + 4 + 4 > buf.length) return null;
      timescale = buf.readUInt32BE(body + 4 + 8);
      duration = buf.readUInt32BE(body + 4 + 12);
    }

    if (!timescale || !duration) return null;
    // 0xFFFFFFFF means "unknown" in the 32-bit form.
    if (version !== 1 && duration === 0xffffffff) return null;

    return duration / timescale;
  }

  /** Walks a nested atom path (e.g. ['moov','mvhd']) and returns the atom offset. */
  private findAtom(
    buf: Buffer,
    start: number,
    end: number,
    path: string[],
  ): number | null {
    if (!path.length) return null;

    let offset = start;
    while (offset + 8 <= end) {
      let size = buf.readUInt32BE(offset);
      const type = buf.toString('binary', offset + 4, offset + 8);
      let headerSize = 8;

      if (size === 1) {
        // 64-bit extended size follows the type field.
        if (offset + 16 > end) return null;
        const hi = buf.readUInt32BE(offset + 8);
        const lo = buf.readUInt32BE(offset + 12);
        size = hi * 2 ** 32 + lo;
        headerSize = 16;
      } else if (size === 0) {
        size = end - offset; // extends to end of file
      }

      if (size < headerSize) return null; // corrupt

      if (type === path[0]) {
        if (path.length === 1) return offset;
        return this.findAtom(buf, offset + headerSize, Math.min(offset + size, end), path.slice(1));
      }

      offset += size;
    }
    return null;
  }

  // ─── OGG (Vorbis / Opus) ───────────────────────────────────────────────────
  // Duration = final granule position / sample rate. Opus always counts granules
  // at 48 kHz regardless of the original input rate.
  private oggDuration(buf: Buffer): number | null {
    if (buf.length < 27 || buf.toString('binary', 0, 4) !== 'OggS') return null;

    const rate = this.oggSampleRate(buf);
    if (!rate) return null;

    // Scan backwards for the last page header — that page holds the final granule.
    for (let i = buf.length - 27; i >= 0; i--) {
      if (
        buf[i] === 0x4f && buf[i + 1] === 0x67 &&
        buf[i + 2] === 0x67 && buf[i + 3] === 0x53 // 'OggS'
      ) {
        const lo = buf.readUInt32LE(i + 6);
        const hi = buf.readUInt32LE(i + 10);
        const granule = hi * 2 ** 32 + lo;
        // -1 (all bits set) means "no packet finishes on this page".
        if (granule > 0 && granule < 2 ** 53) return granule / rate;
      }
    }
    return null;
  }

  /** Sample rate from the first Ogg logical stream's identification header. */
  private oggSampleRate(buf: Buffer): number | null {
    const limit = Math.min(buf.length - 8, 64 * 1024);
    for (let i = 0; i < limit; i++) {
      // Vorbis identification packet: 0x01 'vorbis'
      if (
        buf[i] === 0x01 &&
        buf.toString('binary', i + 1, i + 7) === 'vorbis' &&
        i + 16 <= buf.length
      ) {
        const rate = buf.readUInt32LE(i + 12);
        if (rate > 0) return rate;
      }
      // Opus granules are always at 48 kHz.
      if (buf.toString('binary', i, i + 8) === 'OpusHead') return 48000;
    }
    return null;
  }

  // ─── WebM (EBML) ───────────────────────────────────────────────────────────
  // Segment > Info > { TimecodeScale (default 1e6 ns), Duration (float, scaled) }
  private webmDuration(buf: Buffer): number | null {
    if (buf.length < 4 || buf.readUInt32BE(0) !== 0x1a45dfa3) return null;

    // Duration lives in Info near the file start; cap the scan accordingly.
    const limit = Math.min(buf.length, 1024 * 1024);

    let timecodeScale = 1_000_000; // nanoseconds, EBML default
    let duration: number | null = null;

    for (let i = 0; i < limit - 4; i++) {
      // TimecodeScale id 0x2AD7B1 (3-byte id)
      if (buf[i] === 0x2a && buf[i + 1] === 0xd7 && buf[i + 2] === 0xb1) {
        const parsed = this.readEbmlUInt(buf, i + 3);
        if (parsed !== null) timecodeScale = parsed;
      }
      // Duration id 0x4489 (2-byte id), payload is a 4- or 8-byte float
      if (buf[i] === 0x44 && buf[i + 1] === 0x89) {
        const sizeInfo = this.readEbmlSize(buf, i + 2);
        if (sizeInfo) {
          const { value: len, next } = sizeInfo;
          if (len === 4 && next + 4 <= buf.length) duration = buf.readFloatBE(next);
          else if (len === 8 && next + 8 <= buf.length) duration = buf.readDoubleBE(next);
        }
      }
      if (duration !== null && duration > 0) {
        // Duration is expressed in timecode units; scale is ns per unit.
        return (duration * timecodeScale) / 1e9;
      }
    }
    return null;
  }

  /** Reads an EBML element size (VINT) at `offset`. */
  private readEbmlSize(buf: Buffer, offset: number): { value: number; next: number } | null {
    if (offset >= buf.length) return null;

    const first = buf[offset];
    if (first === 0) return null;

    let length = 1;
    let mask = 0x80;
    while (length <= 8 && !(first & mask)) {
      mask >>= 1;
      length++;
    }
    if (length > 8 || offset + length > buf.length) return null;

    let value = first & (mask - 1); // strip the length marker bit
    for (let i = 1; i < length; i++) value = value * 256 + buf[offset + i];

    return { value, next: offset + length };
  }

  /** Reads an EBML unsigned-integer element's value, given the id end offset. */
  private readEbmlUInt(buf: Buffer, offset: number): number | null {
    const sizeInfo = this.readEbmlSize(buf, offset);
    if (!sizeInfo) return null;

    const { value: len, next } = sizeInfo;
    if (len < 1 || len > 8 || next + len > buf.length) return null;

    let value = 0;
    for (let i = 0; i < len; i++) value = value * 256 + buf[next + i];
    return value;
  }

  // ─── ADTS (raw .aac) ───────────────────────────────────────────────────────
  // No global header — walk the frames. Each carries 1024 samples.
  private adtsDuration(buf: Buffer): number | null {
    const SAMPLE_RATES = [
      96000, 88200, 64000, 48000, 44100, 32000,
      24000, 22050, 16000, 12000, 11025, 8000, 7350,
    ];

    let offset = 0;
    // Tolerate a leading ID3 tag — some encoders write one.
    offset = this.skipId3(buf);

    let sampleRate = 0;
    let frames = 0;

    while (offset + 7 <= buf.length) {
      // Syncword: 12 set bits.
      if (buf[offset] !== 0xff || (buf[offset + 1] & 0xf0) !== 0xf0) {
        // Resync rather than give up — a stray byte should not void the file.
        offset++;
        continue;
      }

      const rateIndex = (buf[offset + 2] >> 2) & 0x0f;
      const frameLength =
        ((buf[offset + 3] & 0x03) << 11) |
        (buf[offset + 4] << 3) |
        ((buf[offset + 5] >> 5) & 0x07);

      if (frameLength < 7 || rateIndex >= SAMPLE_RATES.length) {
        offset++;
        continue;
      }

      if (!sampleRate) sampleRate = SAMPLE_RATES[rateIndex];
      frames++;
      offset += frameLength;
    }

    if (!frames || !sampleRate) return null;
    return (frames * 1024) / sampleRate;
  }
}
