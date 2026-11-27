import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString, Length } from 'class-validator';
import { AppTarget } from '../../account-roles/account-role.enum';

const TARGETS: AppTarget[] = ['matrimony', 'providers'];

export class CreateHandoffDto {
  @ApiProperty({ enum: TARGETS, description: 'The web app to switch to.' })
  @IsIn(TARGETS)
  target: AppTarget;
}

export class ExchangeHandoffDto {
  @ApiProperty()
  @IsString() @Length(20, 100)
  code: string;

  @ApiProperty({ enum: TARGETS, description: 'The web app doing the exchange (must match the code).' })
  @IsIn(TARGETS)
  target: AppTarget;
}
