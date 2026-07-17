import {
  Injectable,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Gallery } from './entity/gallery.entity';
import { CloudStorageService } from 'src/common/services/cloud-storage.service';
import {
  GalleryItemDto,
  GalleryDeleteResponseDto,
  GalleryListResponseDto,
  GalleryResponseDto,
} from './dto/gallery-response.dto';
import { User } from '../user/entity';
import { ImageService } from '../image/image.service';
import { ImageContext } from '../image/enums/image-context.enum';

@Injectable()
export class GalleryService {
  constructor(
    @InjectRepository(Gallery)
    private readonly galleryRepo: Repository<Gallery>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly cloudStorageService: CloudStorageService,
    private readonly imageService: ImageService
  ) {}

  // ── Helpers ────────────────────────────────────────────────────────────────

  private toItemDto(gallery: Gallery): GalleryItemDto {
    return {
      id:          gallery.id,
      profileId:   gallery.profileId,
      imageUrl:    gallery.imageUrl,
      imageName:   gallery.imageName,
      variants:    gallery.variants,
      imageSize:   gallery.imageSize,
      mimeType:    gallery.mimeType,
      uploadedBy:  gallery.uploadedBy,
      createdAt:   gallery.createdAt,
      updatedAt:   gallery.updatedAt,
    };
  }

  // ── Upload ─────────────────────────────────────────────────────────────────

  async uploadGalleryImage(
    profileId: string,
    file: Express.Multer.File,
    uploadedBy: string,
  ): Promise<GalleryResponseDto> {
    try {
      // Validate file presence
      if (!file) {
        throw new BadRequestException('No file provided');
      }

      // Re-use the cloud service's built-in validator (mime + size)
      await this.cloudStorageService.isFileValid(file);

      // Upload to GCS under a profile-scoped folder
      const folder = `matrimony/gallery/${profileId}`;
      const imageUrl = await this.cloudStorageService.uploadFile(file, folder);

      // Persist record
      const gallery = this.galleryRepo.create({
        profileId,
        imageUrl,
        imageName:  file.originalname,
        imageSize:  file.size,
        mimeType:   file.mimetype,
        uploadedBy,
        isDeleted:  false,
        deletedAt:  null,
      });

      const saved = await this.galleryRepo.save(gallery);

      return {
        success: true,
        message: 'Gallery image uploaded successfully',
        data:    this.toItemDto(saved),
      };
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      throw new InternalServerErrorException(
        `Failed to upload gallery image: ${err instanceof Error ? err.message : 'Unknown error'}`,
      );
    }
  }

  async uploadGalleryVariantImage(
    profileId: string,
    file: Express.Multer.File,
    uploadedBy: string,
  ): Promise<GalleryResponseDto> {
    try {
      // Validate file presence
      if (!file) {
        throw new BadRequestException('No file provided');
      }

      // Re-use the cloud service's built-in validator (mime + size)
      await this.cloudStorageService.isFileValid(file);

      const variants = await this.imageService.uploadImageWithVariants(uploadedBy, file, ImageContext.GALLERY);

      if (variants.success) {
        // Persist record
        const gallery = this.galleryRepo.create({
          profileId,
          imageUrl: variants.data.thumbnailUrl,
          variants: { originalUrl: variants.data?.originalUrl, displayUrl: variants.data?.displayUrl, thumbnailUrl: variants.data?.thumbnailUrl },
          imageName: file.originalname,
          imageSize: variants.data?.images?.imageSize,
          mimeType: file.mimetype,
          uploadedBy,
          isDeleted: false,
          deletedAt: null,
        });
        const saved = await this.galleryRepo.save(gallery);
        return {
          success: true,
          message: 'Gallery image uploaded successfully',
          data: this.toItemDto(saved),
        };
      }
      else {
        return {
          success: false,
          message: 'Gallery image upload failed',
          data: null
        };
      }
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      throw new InternalServerErrorException(
        `Failed to upload gallery image: ${err instanceof Error ? err.message : 'Unknown error'}`,
      );
    }
  }  
  
  // ── Fetch by Profile ───────────────────────────────────────────────────────

  async getGalleryByProfileId(profileId: string): Promise<GalleryListResponseDto> {
    try {
      const images = await this.galleryRepo.find({
        where: { profileId, isDeleted: false },
        order: { createdAt: 'DESC' },
      });

      return {
        success: true,
        message: 'Gallery images fetched successfully',
        data:    images.map((g) => this.toItemDto(g)),
        total:   images.length,
      };
    } catch (err) {
      throw new InternalServerErrorException(
        `Failed to fetch gallery images: ${err instanceof Error ? err.message : 'Unknown error'}`,
      );
    }
  }

  // ── Fetch Single ───────────────────────────────────────────────────────────

  async getGalleryById(id: string): Promise<GalleryResponseDto> {
    try {
      const gallery = await this.galleryRepo.findOne({
        where: { id, isDeleted: false },
      });

      if (!gallery) {
        throw new NotFoundException(`Gallery image not found with id: ${id}`);
      }

      return {
        success: true,
        message: 'Gallery image fetched successfully',
        data:    this.toItemDto(gallery),
      };
    } catch (err) {
      if (err instanceof NotFoundException) throw err;
      throw new InternalServerErrorException(
        `Failed to fetch gallery image: ${err instanceof Error ? err.message : 'Unknown error'}`,
      );
    }
  }



  // ── Fetch Single for public access ────────────────────────────────────────────────────────

  async getGalleryViewById(profileId: string): Promise<GalleryListResponseDto> {
    try {
      const images = await this.galleryRepo.find({
        where: { profileId, isDeleted: false },
        order: { createdAt: 'DESC' },
      });

      const gallary = images.length > 4 ? images.slice(0, 4) : images;

      return {
        success: true,
        message: 'Gallery images fetched successfully',
        data:    gallary.map((g) => this.toItemDto(g)),
        total:   gallary.length,
      };
    } catch (err) {
      throw new InternalServerErrorException(
        `Failed to fetch gallery images: ${err instanceof Error ? err.message : 'Unknown error'}`,
      );
    }
  }

  // ── Soft Delete ────────────────────────────────────────────────────────────

  async deleteGalleryImage(id: string): Promise<GalleryDeleteResponseDto> {
    try {
      const gallery = await this.galleryRepo.findOne({
        where: { id, isDeleted: false },
      });

      if (!gallery) {
        throw new NotFoundException(`Gallery image not found with id: ${id}`);
      }

      gallery.isDeleted = true;
      gallery.deletedAt = new Date();
      await this.galleryRepo.save(gallery);

      return {
        success: true,
        message: 'Gallery image deleted successfully',
      };
    } catch (err) {
      if (err instanceof NotFoundException) throw err;
      throw new InternalServerErrorException(
        `Failed to delete gallery image: ${err instanceof Error ? err.message : 'Unknown error'}`,
      );
    }
  }
}
