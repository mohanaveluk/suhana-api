import {
  Controller, Get, Post, Patch, Param, Body, Query,
  UseGuards, Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { MatchesService } from './matches.service';
import { GenerateMatchesDto, UpdateMatchStatusDto } from './dto/match.dto';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';

@ApiTags('matches')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('matches')
export class MatchesController {
  constructor(private readonly matchesService: MatchesService) {}

  @Post('generate')
  @ApiOperation({ summary: 'Generate AI-powered matches for the current user' })
  @ApiResponse({ status: 201, description: 'Matches generated' })
  generateMatches(@Request() req: any, @Body() dto: GenerateMatchesDto) {
    return this.matchesService.generateMatches(req.user.id, dto.count || 4);
  }

  @Get()
  @ApiOperation({ summary: 'Get all matches for the current user' })
  @ApiResponse({ status: 200, description: 'List of matches' })
  getMatches(@Request() req: any) {
    return this.matchesService.getMatches(req.user.id);
  }

  @Get('user/:matchUserId')
  @ApiOperation({ summary: 'Get all matches for the current user' })
  @ApiResponse({ status: 200, description: 'List of matches' })
  getMatcheByUser(@Request() req: any, @Param('matchUserId') matchUserId: string) {
    return this.matchesService.getMatchesByUsers(req.user.id, matchUserId);
  }

  @Get('userx/:matchUserId')
  @ApiOperation({ summary: 'Get all matches for the current user' })
  @ApiResponse({ status: 200, description: 'List of matches' })
  getAIMatchesByUser(@Request() req: any, @Param('matchUserId') matchUserId: string) {
    return this.matchesService.getAIMatchesByUsers(req.user.id, matchUserId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get match by ID' })
  @ApiResponse({ status: 200, description: 'Match details' })
  getMatchById(@Param('id') id: string) {
    return this.matchesService.getMatchById(id);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Update match status (shortlist, interested, connected, skip, reconsider)' })
  @ApiResponse({ status: 200, description: 'Status updated' })
  updateStatus(@Param('id') id: string, @Body() dto: UpdateMatchStatusDto) {
    return this.matchesService.updateStatus(id, dto.status);
  }
}
