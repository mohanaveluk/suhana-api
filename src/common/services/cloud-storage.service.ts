import { Injectable, BadRequestException } from '@nestjs/common';
import { Storage } from '@google-cloud/storage';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class CloudStorageService {
  private storage: Storage;
  private bucketName: string;

  constructor() {
    // Initialize Google Cloud Storage
    if (process.env.NODE_ENV === "development") {
      this.storage = new Storage({
        keyFilename: './starinvoice-2654b9cffc1d.json',
        projectId: "starinvoice"
      });
    }
    else {
      this.storage = new Storage();
    }
    this.bucketName = process.env.GCP_BUCKET || 'inv-images';
  }

  async uploadFile(
    file: Express.Multer.File,
    folder: string = 'uploads'
  ): Promise<string> {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    try {
      const fileName = `${folder}/${uuidv4()}-${file.originalname}`;
      const bucket = this.storage.bucket(this.bucketName);
      const fileUpload = bucket.file(fileName);

      const stream = fileUpload.createWriteStream({
        metadata: {
          contentType: file.mimetype,
        },
        //public: true,
        validation: 'md5',
      });

      return new Promise((resolve, reject) => {
        stream.on('error', (error) => {
          reject(new BadRequestException(`Upload failed: ${error.message}`));
        });

        stream.on('finish', async () => {
          try {
            // Make the file public
            //await fileUpload.makePublic();

            // Return the public URL
            const publicUrl = `https://storage.googleapis.com/${this.bucketName}/${fileName}`;
            resolve(publicUrl);
          } catch (error) {
            reject(
              new BadRequestException(
                `Failed to make file public: ${error.message}`
              )
            );
          }
        });

        stream.end(file.buffer);
      });
    } catch (error) {
      throw new BadRequestException(`Upload service error: ${error.message}`);
    }
  }

  /**
   * Uploads an audio file under an explicit object name and returns the full
   * storage metadata (the plain uploadFile only returns a URL, and generates its
   * own uuid-prefixed name).
   *
   * The caller supplies `fileName` so it can apply its own naming scheme; the
   * name is never derived from client input, and an existing object is never
   * overwritten.
   */
  async uploadVoiceFile(
    file: Express.Multer.File,
    folder: string,
    fileName?: string,
  ): Promise<{
    url: string;
    bucket: string;
    fileName: string;
    folder: string;
    mimeType: string;
    size: number;
  }> {
    if (!file?.buffer?.length) {
      throw new BadRequestException('No file provided');
    }

    const objectName = fileName || `${uuidv4()}-${file.originalname}`;
    const fullPath = `${folder}/${objectName}`;

    try {
      const bucket = this.storage.bucket(this.bucketName);
      const target = bucket.file(fullPath);

      await new Promise<void>((resolve, reject) => {
        const stream = target.createWriteStream({
          metadata: { contentType: file.mimetype },
          validation: 'md5',
          // Fails the write if the object already exists, so a name collision
          // can never silently destroy a previous upload.
          preconditionOpts: { ifGenerationMatch: 0 },
        });

        stream.on('error', (error) =>
          reject(new BadRequestException(`Upload failed: ${error.message}`)),
        );
        stream.on('finish', () => resolve());
        stream.end(file.buffer);
      });

      return {
        url: `https://storage.googleapis.com/${this.bucketName}/${fullPath}`,
        bucket: this.bucketName,
        fileName: objectName,
        folder,
        mimeType: file.mimetype,
        size: file.buffer.length,
      };
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException(`Upload service error: ${error.message}`);
    }
  }

  async deleteFile(fileUrl: string): Promise<void> {
    try {
      // Extract filename from Google Cloud Storage URL
      const fileName = this.extractFileNameFromUrl(fileUrl);
      if (!fileName) {
        throw new BadRequestException('Invalid file URL');
      }

      const bucket = this.storage.bucket(this.bucketName);
      const file = bucket.file(fileName);

      await file.delete();
    } catch (error) {
      // Don't throw error if file doesn't exist, just log it
      console.warn(`Failed to delete file: ${error.message}`);
    }
  }

  private extractFileNameFromUrl(url: string): string | null {
    try {
      const urlParts = url.split('/');
      const bucketIndex = urlParts.indexOf(this.bucketName);
      if (bucketIndex === -1 || bucketIndex === urlParts.length - 1) {
        return null;
      }
      return urlParts.slice(bucketIndex + 1).join('/');
    } catch {
      return null;
    }
  }

  async isFileValid(file: Express.Multer.File): Promise<boolean> {
    const fileCategories: { label: string; mimeTypes: string[]; maxMb: number }[] = [
      {
        label: 'image',
        mimeTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'],
        maxMb: 8,
      },
      {
        label: 'document',
        mimeTypes: [
          'text/plain',
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/vnd.ms-excel',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.ms-powerpoint',
          'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        ],
        maxMb: 10,
      },
      {
        label: 'archive',
        mimeTypes: [
          'application/zip',
          'application/x-zip-compressed',
          'application/x-rar-compressed',
          'application/x-7z-compressed',
          'application/x-tar',
          'application/gzip',
        ],
        maxMb: 50,
      },
      {
        label: 'audio',
        mimeTypes: ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/aac', 'audio/flac', 'audio/mp4', 'audio/x-m4a'],
        maxMb: 50,
      },
      {
        label: 'video',
        mimeTypes: ['video/mp4', 'video/avi', 'video/quicktime', 'video/x-matroska', 'video/webm', 'video/x-ms-wmv', 'video/x-flv'],
        maxMb: 200,
      },
    ];

    const matched = fileCategories.find((c) => c.mimeTypes.includes(file.mimetype));
    if (!matched) {
      throw new BadRequestException(`File type '${file.mimetype}' is not allowed.`);
    }

    const maxBytes = matched.maxMb * 1024 * 1024;
    if (file.size > maxBytes) {
      throw new BadRequestException(
        `File too large. Maximum size for ${matched.label} files is ${matched.maxMb}MB.`,
      );
    }

    return true;
  }
}
