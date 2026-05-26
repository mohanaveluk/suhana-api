import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Request,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
  ApiParam,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';

import { GalleryService } from './gallery.service';
import { UploadGalleryBodyDto } from './dto/create-gallery.dto';
import {
  GalleryResponseDto,
  GalleryListResponseDto,
  GalleryDeleteResponseDto,
} from './dto/gallery-response.dto';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { maxFileSize } from 'src/shared/utils/file-validation.util';

@ApiTags('gallery')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('gallery')
export class GalleryController {
  constructor(private readonly galleryService: GalleryService) {}

  // ── POST /gallery/upload/:profileId ────────────────────────────────────────

  @Post('upload/:profileId')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({
    summary: 'Upload a gallery image for a profile',
    description: 'Uploads a single image (jpg / jpeg / png / webp, max 5 MB) and stores it in the profile gallery.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: UploadGalleryBodyDto })
  @ApiParam({
    name: 'profileId',
    type: 'string',
    description: 'UUID of the profile to attach the image to',
    example: '0dc806a8-395d-4149-9830-55e869633490',
  })
  @ApiResponse({ status: 201, description: 'Image uploaded successfully', type: GalleryResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid file type, size exceeded, or bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized — JWT token missing or invalid' })
  @ApiResponse({ status: 500, description: 'Internal server error during upload' })
  uploadGalleryImage(
    @Param('profileId', ParseUUIDPipe) profileId: string,
    @Request() req: any,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: maxFileSize }),
          new FileTypeValidator({ fileType: /^image\/(jpeg|jpg|png|webp)$/ }),
        ],
        errorHttpStatusCode: 400,
      }),
    )
    file: Express.Multer.File,
  ): Promise<GalleryResponseDto> {
    return this.galleryService.uploadGalleryImage(profileId, file, req.user.id);
  }

  // ── GET /gallery/profile/:profileId ───────────────────────────────────────

  @Get('profile/:profileId')
  @ApiOperation({
    summary: 'Get all gallery images for a profile',
    description: 'Returns all active (non-deleted) gallery images for the given profile, sorted latest first.',
  })
  @ApiParam({
    name: 'profileId',
    type: 'string',
    description: 'UUID of the profile',
    example: '0dc806a8-395d-4149-9830-55e869633490',
  })
  @ApiResponse({ status: 200, description: 'Gallery images returned', type: GalleryListResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  getGalleryByProfileId(
    @Param('profileId', ParseUUIDPipe) profileId: string,
  ): Promise<GalleryListResponseDto> {
    return this.galleryService.getGalleryByProfileId(profileId);
  }

  // ── GET /gallery/:id ──────────────────────────────────────────────────────

  @Get(':id')
  @ApiOperation({
    summary: 'Get a single gallery image by its ID',
    description: 'Returns a single gallery record. Returns 404 if not found or already deleted.',
  })
  @ApiParam({
    name: 'id',
    type: 'string',
    description: 'UUID of the gallery record',
    example: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
  })
  @ApiResponse({ status: 200, description: 'Gallery image returned', type: GalleryResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Gallery image not found' })
  getGalleryById(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<GalleryResponseDto> {
    return this.galleryService.getGalleryById(id);
  }

  // ── DELETE /gallery/:id ───────────────────────────────────────────────────

  @Delete(':id')
  @ApiOperation({
    summary: 'Soft-delete a gallery image',
    description: 'Marks the image as deleted (sets is_deleted = true and deleted_at timestamp). The DB record is retained.',
  })
  @ApiParam({
    name: 'id',
    type: 'string',
    description: 'UUID of the gallery record to delete',
    example: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
  })
  @ApiResponse({ status: 200, description: 'Gallery image soft-deleted', type: GalleryDeleteResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Gallery image not found' })
  deleteGalleryImage(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<GalleryDeleteResponseDto> {
    return this.galleryService.deleteGalleryImage(id);
  }
}
