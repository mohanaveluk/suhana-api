import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ImageContext } from '../enums/image-context.enum';
import { UploadedVariant } from './upload-image-body.dto';

export class UploadedImageItemDto {
  @ApiProperty({ example: 'uuid-...' })
  id: string;

  @ApiProperty({ example: 'uuid-...' })
  userId: string;

  @ApiPropertyOptional({ example: 'uuid-...' })
  profileId: string;

  @ApiProperty({ enum: ImageContext, example: ImageContext.PROFILE })
  context: ImageContext;

  @ApiProperty({ example: 'https://storage.googleapis.com/bucket/matrimony/profile/uuid/file.jpg' })
  imageUrl: string;

  @ApiProperty({ example: 'https://storage.googleapis.com/bucket/matrimony/profile/uuid/display.jpg' })
  displayUrl: string;
  
  @ApiProperty({ example: 'https://storage.googleapis.com/bucket/matrimony/profile/uuid/thumbnail.jpg' })
  thumbnailUrl: string;  

  @ApiPropertyOptional({ example: 'profile-photo.jpg' })
  imageName: string;

  @ApiPropertyOptional({ example: 204800 })
  imageSize: number;

  @ApiPropertyOptional({ example: [
    { suffix: 'original', url: 'https://storage.googleapis.com/bucket/matrimony/profile/uuid/original.jpg', width: 1200, height: 800, size: 204800 },
    { suffix: 'display', url: 'https://storage.googleapis.com/bucket/matrimony/profile/uuid/display.jpg', width: 600, height: 400, size: 102400 },
    { suffix: 'thumbnail', url: 'https://storage.googleapis.com/bucket/matrimony/profile/uuid/thumbnail.jpg', width: 250, height: 167, size: 51200 }
  ], nullable: true, description: 'Array of image variants with their URLs and dimensions' })
  imageVariant?: UploadedVariant[];
  
  @ApiPropertyOptional({ example: 'image/jpeg' })
  mimeType: string;


  @ApiProperty()
  createdAt: Date;
}

export class UploadImageResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 'Image uploaded successfully' })
  message: string;

  @ApiProperty({ type: UploadedImageItemDto })
  data: UploadedImageItemDto;
}

export class ImageListResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 'Images fetched successfully' })
  message: string;

  @ApiProperty({ type: [UploadedImageItemDto] })
  data: UploadedImageItemDto[];

  @ApiProperty({ example: 5 })
  total: number;
}

export class UploadImageVariantsResponseDto {
  success: boolean;
  message: string;
  data: {
    originalUrl: string | null;
    displayUrl: string | null;
    thumbnailUrl: string | null;
    images: UploadedImageItemDto;
  };
}