import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class ProfileIdParamDto {
  @ApiProperty({ example: '3f1c2a9e-6b1d-4c1e-9a7f-2d5e8b9c0a11' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(36)
  profileId: string;
}

export class CompatibilityParamsDto {
  @ApiProperty({ example: '3f1c2a9e-6b1d-4c1e-9a7f-2d5e8b9c0a11' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(36)
  profileIdA: string;

  @ApiProperty({ example: '7d4e1b2c-8a9f-4e3d-b2c1-0f9e8d7c6b5a' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(36)
  profileIdB: string;
}
