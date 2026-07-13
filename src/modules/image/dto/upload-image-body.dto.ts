import { ApiProperty } from '@nestjs/swagger';
import { ImageContext } from '../enums/image-context.enum';

// Used purely for Swagger multipart/form-data schema — the real values come via
// @UploadedFile() and @Body('context') in the controller.
export class UploadImageBodyDto {
  @ApiProperty({
    type: 'string',
    format: 'binary',
    description: 'Image file (jpg, jpeg, png, webp — max 5 MB)',
  })
  file: any;

  @ApiProperty({
    enum: ImageContext,
    description: 'Upload context that determines the GCS sub-folder',
    example: ImageContext.PROFILE,
  })
  context: ImageContext;
}


export interface UploadedVariant {
  suffix: string;
  url: string;
  width?: number | null;
  height?: number | null;
  size: number;
}