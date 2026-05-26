import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateGalleryDto {
  @ApiProperty({
    description: 'UUID of the profile this image belongs to',
    example: '0dc806a8-395d-4149-9830-55e869633490',
  })
  @IsUUID('4', { message: 'profileId must be a valid UUID v4' })
  profileId: string;

  @ApiPropertyOptional({
    description: 'UUID of the user performing the upload (defaults to authenticated user)',
    example: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
  })
  @IsOptional()
  @IsUUID('4', { message: 'uploadedBy must be a valid UUID v4' })
  uploadedBy?: string;
}

/** Used only for Swagger multipart body documentation */
export class UploadGalleryBodyDto {
  @ApiProperty({
    type: 'string',
    format: 'binary',
    description: 'Image file — jpg, jpeg, png or webp (max 5 MB)',
  })
  file: any;
}
