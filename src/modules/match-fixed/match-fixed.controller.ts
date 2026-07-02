import {
  Controller, Get, Post, Put, Delete, Body, Param,
  UseGuards, Request,
} from '@nestjs/common';
import {
  ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam,
} from '@nestjs/swagger';

import { MatchFixedService } from './match-fixed.service';
import { CreateMatchFixedDto } from './dto/create-match-fixed.dto';
import { UpdateMatchFixedDto } from './dto/update-match-fixed.dto';
import { MatchFixedResponseDto } from './dto/match-fixed-response.dto';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';

@ApiTags('profile / match-fixed')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('profile/match-fixed')
export class MatchFixedController {
  constructor(private readonly matchFixedService: MatchFixedService) {}

  // POST /profile/match-fixed
  @Post()
  @ApiOperation({
    summary: 'Mark profile as Match Fixed',
    description:
      'Creates a Match Fixed record and hides the profile from search, recommendations, featured, interests, and chat requests.',
  })
  @ApiResponse({ status: 201, description: 'Match Fixed record created', type: MatchFixedResponseDto })
  @ApiResponse({ status: 400, description: 'Validation error or duplicate active record' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Matched Suhana user not found' })
  create(@Request() req: any, @Body() dto: CreateMatchFixedDto) {
    return this.matchFixedService.createMatchFixed(req.user.id, dto);
  }

  // GET /profile/match-fixed/me
  @Get('me')
  @ApiOperation({ summary: 'Get my active Match Fixed record' })
  @ApiResponse({ status: 200, description: 'Active Match Fixed record (null if none)', type: MatchFixedResponseDto })
  getMyMatchFixed(@Request() req: any) {
    return this.matchFixedService.getMyMatchFixed(req.user.id);
  }

  // GET /profile/match-fixed/:id
  @Get(':id')
  @ApiOperation({ summary: 'Get Match Fixed detail by record ID' })
  @ApiParam({ name: 'id', description: 'Match Fixed record UUID' })
  @ApiResponse({ status: 200, description: 'Match Fixed record', type: MatchFixedResponseDto })
  @ApiResponse({ status: 404, description: 'Record not found' })
  findOne(@Param('id') id: string) {
    return this.matchFixedService.getMatchFixed(id);
  }

  // PUT /profile/match-fixed/:id
  @Put(':id')
  @ApiOperation({ summary: 'Update Match Fixed details' })
  @ApiParam({ name: 'id', description: 'Match Fixed record UUID' })
  @ApiResponse({ status: 200, description: 'Updated Match Fixed record', type: MatchFixedResponseDto })
  @ApiResponse({ status: 400, description: 'Validation error or record already cancelled' })
  @ApiResponse({ status: 403, description: 'Forbidden — not your record' })
  @ApiResponse({ status: 404, description: 'Record not found' })
  update(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateMatchFixedDto,
  ) {
    return this.matchFixedService.updateMatchFixed(id, req.user.id, dto);
  }

  // DELETE /profile/match-fixed/:id
  @Delete(':id')
  @ApiOperation({
    summary: 'Cancel (soft-delete) Match Fixed record',
    description: 'Sets the record status to CANCELLED. The profile visibility flags are NOT automatically restored.',
  })
  @ApiParam({ name: 'id', description: 'Match Fixed record UUID' })
  @ApiResponse({ status: 200, description: 'Record cancelled successfully' })
  @ApiResponse({ status: 400, description: 'Record already cancelled' })
  @ApiResponse({ status: 403, description: 'Forbidden — not your record' })
  @ApiResponse({ status: 404, description: 'Record not found' })
  remove(@Request() req: any, @Param('id') id: string) {
    return this.matchFixedService.deleteMatchFixed(id, req.user.id);
  }
}
