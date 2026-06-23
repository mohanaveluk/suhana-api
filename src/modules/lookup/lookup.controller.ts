import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { LookupService } from './lookup.service';

@ApiTags('Lookup')
@Controller('lookup')
export class LookupController {
  constructor(private readonly lookupService: LookupService) {}

  @Get('cities')
  @ApiOperation({ summary: 'Get all unique cities from registered profiles' })
  getCities() {
    return this.lookupService.getAllCities();
  }

  @Get('occupations')
  @ApiOperation({ summary: 'Get all unique occupation titles from registered profiles' })
  getOccupations() {
    return this.lookupService.getAllOccupations();
  }

  @Get('values')
  @ApiOperation({ summary: 'Get all unique occupation titles from registered profiles' })
  getLookupValues() {
    return this.lookupService.getAllValues();
  }

}
