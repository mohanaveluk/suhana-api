// What a stored media file is for. Stored verbatim in media_file.context —
// keep values stable.
//
// Deliberately separate from ImageContext (src/modules/image): that enum
// describes *where an image is shown*, this one describes *what kind of media
// asset this is*. Voice uploads must never share a table or a context space
// with profile images.
export enum MediaContext {
  PROFILE_PHOTO = 'PROFILE_PHOTO',
  PROFILE_GALLERY = 'PROFILE_GALLERY',
  DOCUMENT = 'DOCUMENT',
  VOICE_INTRODUCTION = 'VOICE_INTRODUCTION',
  CHAT_AUDIO = 'CHAT_AUDIO',
  VIDEO_INTRODUCTION = 'VIDEO_INTRODUCTION',
}

// Where the bytes physically live. Only GCS today; kept so a future migration
// to another provider does not require a schema change.
export enum StorageProvider {
  GCS = 'GCS',
}
