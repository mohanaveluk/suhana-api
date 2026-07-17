import {
  BadRequestException, Injectable, InternalServerErrorException, NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import  sharp from 'sharp';

import { UploadedImage } from './entity/uploaded-image.entity';
import { ImageContext } from './enums/image-context.enum';
import {
  UploadedImageItemDto, UploadImageResponseDto, ImageListResponseDto,
  UploadImageVariantsResponseDto,
} from './dto/image-response.dto';
import { CloudStorageService } from 'src/common/services/cloud-storage.service';
import { User } from '../user/entity';
import { IMAGE_VARIANTS, ImageVariantConfig } from './config/image-size.config';
import { CustomLoggerService } from '../logger/custom-logger.service';
import { UploadedVariant } from './dto/upload-image-body.dto';


@Injectable()
export class ImageService {
  constructor(
    @InjectRepository(UploadedImage)
    private readonly imageRepo: Repository<UploadedImage>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly cloudStorageService: CloudStorageService,
    private readonly logger: CustomLoggerService,
  ) {}

  /**
   * Upload a file to GCS and persist the record in uploaded_images.
   * Folder path: matrimony/<context>/<profileId>/<uuid>-<filename>
   */
  async uploadImage(
    userId: string,
    file: Express.Multer.File,
    context: ImageContext,
  ): Promise<UploadImageResponseDto> {
    try {
      if (!file) throw new BadRequestException('No file provided');

      // Validate mime-type and size before touching GCS
      await this.cloudStorageService.isFileValid(file);

      const user = await this.userRepo.findOne({
        where: { id: userId },
        relations: ['profile'],
      });
      if (!user) throw new NotFoundException('User not found');
      if (!user.profile) throw new NotFoundException('Profile not found');

      const folder = `matrimony/${context}/${user.profile.id}`;
      const imageUrl = await this.cloudStorageService.uploadFile(file, folder);

      const image = this.imageRepo.create({
        userId,
        profileId: user.profile.id,
        context,
        imageUrl,
        imageName: file.originalname,
        imageSize: file.size,
        mimeType: file.mimetype,
        isDeleted: false,
        deletedAt: null,
      });

      const saved = await this.imageRepo.save(image);

      return {
        success: true,
        message: 'Image uploaded successfully',
        data: this.toItemDto(saved),
      };
    } catch (err) {
      if (
        err instanceof BadRequestException ||
        err instanceof NotFoundException
      ) throw err;
      throw new InternalServerErrorException(
        `Upload failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
      );
    }
  }

/**
   * Uploads original + generates display/thumbnail variants, all to GCS.
   */
  async uploadImageWithVariants(
    userId: string,
    file: Express.Multer.File,
    context: ImageContext,
  ): Promise<UploadImageVariantsResponseDto> {
    try {
      if (!file) throw new BadRequestException('No file provided');

      await this.cloudStorageService.isFileValid(file);

      const user = await this.userRepo.findOne({
        where: { id: userId },
        relations: ['profile'],
      });
      if (!user) throw new NotFoundException('User not found');
      if (!user.profile) throw new NotFoundException('Profile not found');

      const folder = `matrimony/${context}/${user.profile.id}`;
      const baseName = this.stripExtension(file.originalname);

      // Generate + upload all variants in parallel
      const uploadedVariants = await this.generateAndUploadVariants(
        file,
        folder,
        baseName,
      );

    // Build the JSON shape from the array of variant results
      const imageVariant: UploadedVariant[] = uploadedVariants.map(({ suffix, url, size }) => ({
        suffix,
        url,
        size,
      }));      

      // Persist one row per variant (or adjust to a single row with JSON column — see note below)
      /*const savedEntities = await Promise.all(
        uploadedVariants.map((variant) =>
          this.imageRepo.save(
            this.imageRepo.create({
              userId,
              profileId: user.profile.id,
              context,
              imageUrl: this.findUrlBySuffix(uploadedVariants, variant.suffix) || variant.url,
              displayUrl: variant.url,
              thumbnailUrl: variant.url,
              imageName: `${baseName}-${variant.suffix}${this.getExtension(file.originalname)}`,
              imageSize: variant.size,
              mimeType: file.mimetype,
              variant: variant.suffix, // requires a new column, see note below
              isDeleted: false,
              deletedAt: null,
            }),
          ),
        ),
      );*/
      const saved = await this.imageRepo.save(
        this.imageRepo.create({
          userId,
          profileId: user.profile.id,
          context,
          imageUrl: this.findUrlBySuffix(uploadedVariants, 'original'),
          displayUrl: this.findUrlBySuffix(uploadedVariants, 'display'),
          thumbnailUrl: this.findUrlBySuffix(uploadedVariants, 'thumbnail'),
          imageName: `${baseName}-${this.getExtension(file.originalname)}`,
          imageSize: this.findSizeBySuffix(uploadedVariants, 'original'),
          mimeType: file.mimetype,
          //imageVariant: imageVariant,
          isDeleted: false,
          deletedAt: null,
        }),
      );


      return {
        success: true,
        message: 'Image uploaded and variants generated successfully',
        data: {
          originalUrl: this.findUrlBySuffix(uploadedVariants, 'original'),
          displayUrl: this.findUrlBySuffix(uploadedVariants, 'display'),
          thumbnailUrl: this.findUrlBySuffix(uploadedVariants, 'thumbnail'),
          images: this.toItemDto(saved),
        },
      };
    } catch (err) {
      if (err instanceof BadRequestException || err instanceof NotFoundException) {
        throw err;
      }
      this.logger.error(`Variant upload failed: ${err instanceof Error ? err.stack : err}`);
      throw new InternalServerErrorException(
        `Upload failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * List all images uploaded by the authenticated user.
   * Optionally filtered by context.
   */
  async getMyImages(userId: string, context?: ImageContext): Promise<ImageListResponseDto> {
    try {
      const where: Record<string, unknown> = { userId, isDeleted: false };
      if (context) where.context = context;

      const images = await this.imageRepo.find({
        where,
        order: { createdAt: 'DESC' },
      });

      return {
        success: true,
        message: 'Images fetched successfully',
        data: images.map((img) => this.toItemDto(img)),
        total: images.length,
      };
    } catch (err) {
      throw new InternalServerErrorException(
        `Failed to fetch images: ${err instanceof Error ? err.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Retrieve a single image record by ID.
   * Ownership check ensures users can only access their own uploads.
   */
  async getImageById(id: string, userId: string): Promise<UploadImageResponseDto> {
    const image = await this.imageRepo.findOne({
      where: { id, userId, isDeleted: false },
    });
    if (!image) throw new NotFoundException('Image not found');

    return {
      success: true,
      message: 'Image fetched successfully',
      data: this.toItemDto(image),
    };
  }

  /**
   * Soft-delete an image record (does NOT remove from GCS).
   */
  async deleteImage(id: string, userId: string): Promise<{ success: boolean; message: string }> {
    const image = await this.imageRepo.findOne({
      where: { id, userId, isDeleted: false },
    });
    if (!image) throw new NotFoundException('Image not found');

    image.isDeleted = true;
    image.deletedAt = new Date();
    await this.imageRepo.save(image);

    return { success: true, message: 'Image deleted successfully' };
  }

  // ---------------------------------------------------------------------------

  private toItemDto(image: UploadedImage): UploadedImageItemDto {
    return {
      id: image.id,
      userId: image.userId,
      profileId: image.profileId,
      context: image.context,
      imageUrl: image.imageUrl,
      displayUrl: image.displayUrl,
      thumbnailUrl: image.thumbnailUrl,
      imageName: image.imageName,
      imageSize: image.imageSize,
      mimeType: image.mimeType,
      createdAt: image.createdAt,
    };
  }

private async generateAndUploadVariants(
    file: Express.Multer.File,
    folder: string,
    baseName: string,
  ): Promise<UploadedVariant[]> {
    const ext = this.getExtension(file.originalname);

    const uploads = IMAGE_VARIANTS.map(async (variantConfig: ImageVariantConfig) => {
      const buffer = await this.processImage(file.buffer, variantConfig);

      const variantFile: Express.Multer.File = {
        ...file,
        buffer,
        originalname: `${baseName}-${variantConfig.suffix}${ext}`,
        size: buffer.length,
      };

      const url = await this.cloudStorageService.uploadFile(variantFile, folder);
      const metadata = await sharp(buffer).metadata();

      return {
        suffix: variantConfig.suffix,
        url,
        width: metadata.width ?? null,
        height: metadata.height ?? null,
        size: buffer.length,
      };
    });

    return Promise.all(uploads);
  }

  private async processImage(
    buffer: Buffer,
    config: ImageVariantConfig,
  ): Promise<Buffer> {
    let pipeline = sharp(buffer).rotate(); // auto-orient based on EXIF

    if (config.width && config.height) {
      pipeline = pipeline.resize(config.width, config.height, {
        fit: 'cover',
        position: 'top', // smart-crop toward the most "interesting" region (faces etc.)
      });
    }

    return pipeline.jpeg({ quality: config.quality, mozjpeg: true }).toBuffer();
  }

  private stripExtension(filename: string): string {
    return filename.replace(/\.[^/.]+$/, '');
  }

  private getExtension(filename: string): string {
    const match = filename.match(/\.[^/.]+$/);
    return match ? match[0] : '.jpg';
  }

  private findUrlBySuffix(entities: UploadedVariant[], suffix: string): string | null {
    return entities.find((e) => e.suffix === suffix)?.url ?? null;
  }  

  private findSizeBySuffix(entities: UploadedVariant[], suffix: string): number | null {
    return entities.find((e) => e.suffix === suffix)?.size ?? null;
  }  

  private findBySuffix(
    variants: UploadedVariant[],
    suffix: string,
  ): UploadedVariant {
    const found = variants.find((v) => v.suffix === suffix);
    if (!found) {
      throw new InternalServerErrorException(`Missing generated variant: ${suffix}`);
    }
    return found;
  }
}
