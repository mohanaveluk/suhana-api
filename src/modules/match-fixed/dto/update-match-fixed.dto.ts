import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { CreateMatchFixedDto } from './create-match-fixed.dto';
import { MatchFixedStatus } from '../enums/match-fixed-status.enum';

export class UpdateMatchFixedDto extends PartialType(CreateMatchFixedDto) {
  @ApiPropertyOptional({
    enum: MatchFixedStatus,
    description: 'Record status — use CANCELLED to soft-delete via update',
    example: MatchFixedStatus.ACTIVE,
  })
  @IsOptional()
  @IsEnum(MatchFixedStatus)
  status?: MatchFixedStatus;
}
