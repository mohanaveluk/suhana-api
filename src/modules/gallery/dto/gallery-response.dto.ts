import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// ── Single Gallery Item ───────────────────────────────────────────────────────

export class GalleryItemDto {
  @ApiProperty({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  id: string;

  @ApiProperty({ example: '0dc806a8-395d-4149-9830-55e869633490' })
  profileId: string;

  @ApiProperty({ example: 'https://storage.googleapis.com/bucket/matrimony/gallery/abc/uuid-photo.jpg' })
  imageUrl: string;

  @ApiPropertyOptional({ example: 'profile-photo.jpg' })
  imageName: string;

  @ApiPropertyOptional({ example: 204800, description: 'File size in bytes' })
  imageSize: number;

  @ApiPropertyOptional({ example: 'image/jpeg' })
  mimeType: string;

  @ApiPropertyOptional({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' })
  uploadedBy: string;

  @ApiProperty({ example: '2026-05-22T10:30:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-05-22T10:30:00.000Z' })
  updatedAt: Date;
}

// ── Standardised API Envelope ─────────────────────────────────────────────────

export class GalleryResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 'Gallery image uploaded successfully' })
  message: string;

  @ApiProperty({ type: GalleryItemDto })
  data: GalleryItemDto;
}

export class GalleryListResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 'Gallery images fetched successfully' })
  message: string;

  @ApiProperty({ type: [GalleryItemDto] })
  data: GalleryItemDto[];

  @ApiProperty({ example: 5, description: 'Total number of images' })
  total: number;
}

export class GalleryDeleteResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 'Gallery image deleted successfully' })
  message: string;
}
