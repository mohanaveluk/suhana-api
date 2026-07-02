import {
  BadRequestException, Injectable, InternalServerErrorException, NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { UploadedImage } from './entity/uploaded-image.entity';
import { ImageContext } from './enums/image-context.enum';
import {
  UploadedImageItemDto, UploadImageResponseDto, ImageListResponseDto,
} from './dto/image-response.dto';
import { CloudStorageService } from 'src/common/services/cloud-storage.service';
import { User } from '../user/entity';

@Injectable()
export class ImageService {
  constructor(
    @InjectRepository(UploadedImage)
    private readonly imageRepo: Repository<UploadedImage>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly cloudStorageService: CloudStorageService,
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
      imageName: image.imageName,
      imageSize: image.imageSize,
      mimeType: image.mimeType,
      createdAt: image.createdAt,
    };
  }
}
