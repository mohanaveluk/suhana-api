import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ImageContext } from '../enums/image-context.enum';

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

  @ApiPropertyOptional({ example: 'profile-photo.jpg' })
  imageName: string;

  @ApiPropertyOptional({ example: 204800 })
  imageSize: number;

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
