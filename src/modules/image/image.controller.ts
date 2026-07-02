import {
  Controller, Post, Get, Delete, Param, Body, Query,
  Request, UseGuards, UseInterceptors, UploadedFile,
  ParseFilePipe, MaxFileSizeValidator, FileTypeValidator,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags, ApiOperation, ApiResponse, ApiBearerAuth,
  ApiConsumes, ApiBody, ApiParam, ApiQuery,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';

import { ImageService } from './image.service';
import { ImageContext } from './enums/image-context.enum';
import { UploadImageBodyDto } from './dto/upload-image-body.dto';
import {
  UploadImageResponseDto, ImageListResponseDto,
} from './dto/image-response.dto';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { maxFileSize } from 'src/shared/utils/file-validation.util';

@ApiTags('images')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('images')
export class ImageController {
  constructor(private readonly imageService: ImageService) {}

  // POST /images/upload
  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({
    summary: 'Upload an image',
    description:
      'Uploads an image to Google Cloud Storage under the appropriate folder for the given context. ' +
      'Accepted formats: jpg, jpeg, png, webp. Max size: 5 MB. ' +
      'The upload is also recorded in the database for later retrieval.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: UploadImageBodyDto })
  @ApiResponse({ status: 201, description: 'Image uploaded and recorded', type: UploadImageResponseDto })
  @ApiResponse({ status: 400, description: 'Invalid file type, size, or missing context' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'User or profile not found' })
  async uploadImage(
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
    @Body('context') context: string,
  ): Promise<UploadImageResponseDto> {
    const validContexts = Object.values(ImageContext) as string[];
    if (!context || !validContexts.includes(context)) {
      throw new BadRequestException(
        `context is required and must be one of: ${validContexts.join(', ')}`,
      );
    }
    return this.imageService.uploadImage(req.user.id, file, context as ImageContext);
  }

  // GET /images/my
  @Get('my')
  @ApiOperation({
    summary: 'List my uploaded images',
    description: 'Returns all images uploaded by the authenticated user, sorted latest first. ' +
      'Optionally filter by context (e.g. only PROFILE images).',
  })
  @ApiQuery({
    name: 'context',
    enum: ImageContext,
    required: false,
    description: 'Filter results by upload context',
  })
  @ApiResponse({ status: 200, description: 'List of uploaded images', type: ImageListResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  getMyImages(
    @Request() req: any,
    @Query('context') context?: ImageContext,
  ): Promise<ImageListResponseDto> {
    return this.imageService.getMyImages(req.user.id, context);
  }

  // GET /images/:id
  @Get(':id')
  @ApiOperation({
    summary: 'Get a single image record by ID',
    description: 'Returns the image metadata and URL. Only accessible by the user who uploaded it.',
  })
  @ApiParam({ name: 'id', description: 'Uploaded image record UUID' })
  @ApiResponse({ status: 200, description: 'Image record', type: UploadImageResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Image not found or does not belong to you' })
  getImageById(
    @Request() req: any,
    @Param('id') id: string,
  ): Promise<UploadImageResponseDto> {
    return this.imageService.getImageById(id, req.user.id);
  }

  // DELETE /images/:id
  @Delete(':id')
  @ApiOperation({
    summary: 'Soft-delete an image record',
    description: 'Marks the image as deleted in the database. The file remains in GCS.',
  })
  @ApiParam({ name: 'id', description: 'Uploaded image record UUID' })
  @ApiResponse({ status: 200, description: 'Image soft-deleted' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Image not found or does not belong to you' })
  deleteImage(
    @Request() req: any,
    @Param('id') id: string,
  ): Promise<{ success: boolean; message: string }> {
    return this.imageService.deleteImage(id, req.user.id);
  }
}
