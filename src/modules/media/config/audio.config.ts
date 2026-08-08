// Limits and accepted formats for voice uploads.
// Referenced by the controller guards, the service validation and the Swagger
// docs so the numbers can never drift apart.

export const VOICE_MAX_DURATION_SECONDS = 30;
export const VOICE_MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

/**
 * Accepted audio MIME types.
 *
 * Browsers and mobile clients are inconsistent about what they report for the
 * same container (an m4a arrives as audio/mp4, audio/m4a or audio/x-m4a
 * depending on the platform), so several aliases map to one logical format.
 */
export const ALLOWED_AUDIO_MIME_TYPES = [
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/x-wav',
  'audio/wave',
  'audio/vnd.wave',
  'audio/mp4',
  'audio/m4a',
  'audio/x-m4a',
  'audio/ogg',
  'audio/webm',
  'audio/aac',
  'audio/aacp',
] as const;

/** Accepted file extensions, checked in addition to (never instead of) the MIME type. */
export const ALLOWED_AUDIO_EXTENSIONS = [
  'mp3', 'wav', 'm4a', 'ogg', 'webm', 'aac',
] as const;

/**
 * Canonical container families. Duration parsing dispatches on this rather than
 * on the raw MIME type, so a new alias only needs adding to the map below.
 */
export enum AudioContainer {
  MP3 = 'mp3',
  WAV = 'wav',
  MP4 = 'mp4',   // m4a / aac-in-mp4
  OGG = 'ogg',
  WEBM = 'webm',
  ADTS = 'adts', // raw .aac stream
}

const MIME_TO_CONTAINER: Record<string, AudioContainer> = {
  'audio/mpeg': AudioContainer.MP3,
  'audio/mp3': AudioContainer.MP3,
  'audio/wav': AudioContainer.WAV,
  'audio/x-wav': AudioContainer.WAV,
  'audio/wave': AudioContainer.WAV,
  'audio/vnd.wave': AudioContainer.WAV,
  'audio/mp4': AudioContainer.MP4,
  'audio/m4a': AudioContainer.MP4,
  'audio/x-m4a': AudioContainer.MP4,
  'audio/ogg': AudioContainer.OGG,
  'audio/webm': AudioContainer.WEBM,
  'audio/aac': AudioContainer.ADTS,
  'audio/aacp': AudioContainer.ADTS,
};

const EXTENSION_TO_CONTAINER: Record<string, AudioContainer> = {
  mp3: AudioContainer.MP3,
  wav: AudioContainer.WAV,
  m4a: AudioContainer.MP4,
  mp4: AudioContainer.MP4,
  ogg: AudioContainer.OGG,
  oga: AudioContainer.OGG,
  opus: AudioContainer.OGG,
  webm: AudioContainer.WEBM,
  aac: AudioContainer.ADTS,
};

export function containerFromMime(mimeType: string): AudioContainer | null {
  return MIME_TO_CONTAINER[mimeType?.toLowerCase()?.split(';')[0]?.trim()] ?? null;
}

export function containerFromExtension(extension: string): AudioContainer | null {
  return EXTENSION_TO_CONTAINER[extension?.toLowerCase()?.replace(/^\./, '')] ?? null;
}

export function isAllowedAudioMime(mimeType: string): boolean {
  return containerFromMime(mimeType) !== null;
}

export function isAllowedAudioExtension(extension: string): boolean {
  const normalised = extension?.toLowerCase()?.replace(/^\./, '');
  return (ALLOWED_AUDIO_EXTENSIONS as readonly string[]).includes(normalised);
}

/**
 * Optional ffmpeg normalisation target — mono, 64 kbps, 22.05 kHz mp3.
 * Applied only when an ffmpeg binary is present at runtime.
 */
export const VOICE_NORMALISE_TARGET = {
  channels: 1,
  bitrate: '64k',
  sampleRate: 22050,
  format: 'mp3',
  mimeType: 'audio/mpeg',
  extension: 'mp3',
} as const;
