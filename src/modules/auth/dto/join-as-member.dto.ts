import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * An existing, signed-in Aurora account (e.g. a business-only provider) joins
 * Aurora Matrimony with the same email and password. The profile details are
 * then saved with the usual PATCH /profiles/me.
 */
export class JoinAsMemberDto {
  @ApiProperty({ enum: ['bride', 'groom'] })
  @IsIn(['bride', 'groom'])
  gender: 'bride' | 'groom';

  @ApiPropertyOptional()
  @IsOptional() @IsString() @MaxLength(100)
  firstName?: string;

  @ApiPropertyOptional()
  @IsOptional() @IsString() @MaxLength(100)
  lastName?: string;
}
