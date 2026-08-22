import { ApiProperty } from '@nestjs/swagger';

export class StateResponseDto {
  @ApiProperty({
    description: 'Unique UUID of the state',
    example: 'c81fe682-33a0-11f1-abe6-00155d1e4039',
  })
  id: string;

  @ApiProperty({
    description: 'State code',
    example: 'MH',
  })
  code: string;

  @ApiProperty({
    description: 'State name',
    example: 'Maharashtra',
  })
  name: string;

  @ApiProperty({
    description: 'UUID of the country this state belongs to',
    example: 'c81fe682-33a0-11f1-abe6-00155d1e4039',
  })
  countryId: string;
}

export class StateListResponseDto {
  @ApiProperty({ example: true })
  status: boolean;

  @ApiProperty({ example: 'Retrieved  states' })
  message: string;

  @ApiProperty({ type: [StateResponseDto] })
  data: StateResponseDto[];

  @ApiProperty({ example: '2026-04-09T04:35:25.097Z' })
  timestamp: string;
}

export class StateSingleResponseDto {
  @ApiProperty({ example: true })
  status: boolean;

  @ApiProperty({ example: 'State found' })
  message: string;

  @ApiProperty({ type: StateResponseDto })
  data: StateResponseDto;

  @ApiProperty({ example: '2026-04-09T04:35:25.097Z' })
  timestamp: string;
}