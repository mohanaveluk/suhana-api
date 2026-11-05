import {
  Controller, Post, Get, Delete, Param, Body, Query,
  Request, UseGuards, UseInterceptors, UploadedFile,
  ParseFilePipe, MaxFileSizeValidator, FileTypeValidator,
  BadRequestException, StreamableFile, Header,
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
  UploadImageVariantsResponseDto,
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

  @Post('upload-variants')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({
    summary: 'Upload an image with variants',
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
  async uploadImageWithVariants(
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
    @Body('context') context: ImageContext,
  ): Promise<UploadImageVariantsResponseDto> {
    return this.imageService.uploadImageWithVariants(req.user.id, file, context);
  }


  // POST /images/social-media
  @Post('social-media')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({
    summary: 'Upload a rendered profile poster for social-media / email sharing',
    description:
      'Stores the JPEG at social-media/{profileId}-{datetime}.jpg in the bucket and returns its public URL. ' +
      'Accepted formats: jpg, jpeg, png, webp. Max size: 5 MB.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({ status: 201, description: 'Image uploaded' })
  @ApiResponse({ status: 400, description: 'Invalid file type, size or profileId' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async uploadSocialMediaImage(
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
    @Body('profileId') profileId: string,
  ) {
    return this.imageService.uploadSocialMediaImage(file, profileId);
  }

  // POST /images/profile-media
  @Post('profile-media')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({
    summary: 'Upload a rendered "share profile" card (WhatsApp / email app)',
    description:
      'Stores the JPEG at profile-media/{profileId}-{datetime}.jpg in the bucket and returns its public URL. ' +
      'Accepted formats: jpg, jpeg, png, webp. Max size: 8 MB.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({ status: 201, description: 'Image uploaded' })
  @ApiResponse({ status: 400, description: 'Invalid file type, size or profileId' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async uploadProfileMediaImage(
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
    @Body('profileId') profileId: string,
  ) {
    return this.imageService.uploadProfileMediaImage(file, profileId);
  }

  // GET /images/proxy?url=...
  @Get('proxy')
  @ApiOperation({
    summary: 'Fetch a stored Aurora image through the API',
    description: 'Returns the bytes of an image in our own bucket (matrimony/ folder) so the web app can render it onto a canvas.',
  })
  @Header('X-Content-Type-Options', 'nosniff')
  @Header('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; sandbox")
  @ApiQuery({ name: 'url', required: true })
  @ApiResponse({ status: 200, description: 'Image bytes' })
  @ApiResponse({ status: 400, description: 'URL is not one of our stored images' })
  @ApiResponse({ status: 404, description: 'Image could not be retrieved' })
  async proxyImage(@Query('url') url: string): Promise<StreamableFile> {
    const { buffer, contentType } = await this.imageService.fetchStoredImage(url);
    return new StreamableFile(buffer, { type: contentType });
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
