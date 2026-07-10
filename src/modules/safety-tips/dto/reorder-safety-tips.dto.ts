import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsInt, IsUUID, Min, ValidateNested } from 'class-validator';

export class ReorderItemDto {
  @ApiProperty({ description: 'Safety tip UUID' })
  @IsUUID()
  id: string;

  @ApiProperty({ description: 'New display order value', minimum: 0 })
  @IsInt()
  @Min(0)
  displayOrder: number;
}

export class ReorderSafetyTipsDto {
  @ApiProperty({ type: [ReorderItemDto], description: 'Array of id + displayOrder pairs' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReorderItemDto)
  items: ReorderItemDto[];
}
