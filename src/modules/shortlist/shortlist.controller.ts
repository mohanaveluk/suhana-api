import { Controller, Get, Patch, Param, UseGuards, Request, Post, Delete } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { ShortlistService } from './shortlist.service';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';

@ApiTags('shortlist')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('shortlist')
export class ShortlistController {
  constructor(private readonly shortlistService: ShortlistService) {}

  @Get()
  @ApiOperation({ summary: 'Get all shortlisted profiles' })
  @ApiResponse({ status: 200, description: 'Shortlisted profiles list' })
  getShortlisted(@Request() req: any) {
    return this.shortlistService.getShortlisted(req.user.id);
  }

  @Get('interested')
  @ApiOperation({ summary: 'Get all profiles where interest is sent' })
  getInterested(@Request() req: any) {
    return this.shortlistService.getInterested(req.user.id);
  }

  @Get('connected')
  @ApiOperation({ summary: 'Get all connected profiles' })
  getConnected(@Request() req: any) {
    return this.shortlistService.getConnected(req.user.id);
  }

  @Post('user/:matchedUserId')
  @ApiOperation({ summary: 'Shortlist a profile' })
  @ApiResponse({ status: 200, description: 'Profile shortlisted' })
  shortlistByUser(@Request() req: any,@Param('matchedUserId') matchedUserId: string) {
    return this.shortlistService.shortlistUser(req.user.id, matchedUserId);
  }

  @Patch(':id/shortlist')
  @ApiOperation({ summary: 'Shortlist a match' })
  shortlist(@Param('id') id: string) {
    return this.shortlistService.shortlist(id);
  }

  @Patch(':id/interest')
  @ApiOperation({ summary: 'Express interest in a match' })
  expressInterest(@Param('id') id: string) {
    return this.shortlistService.expressInterest(id);
  }

  @Patch(':id/connect')
  @ApiOperation({ summary: 'Connect with a match' })
  connect(@Param('id') id: string) {
    return this.shortlistService.connect(id);
  }

  @Patch(':id/skip')
  @ApiOperation({ summary: 'Skip a match' })
  skip(@Param('id') id: string) {
    return this.shortlistService.skip(id);
  }

  @Patch(':id/reconsider')
  @ApiOperation({ summary: 'Reconsider a skipped match' })
  reconsider(@Param('id') id: string) {
    return this.shortlistService.reconsider(id);
  }

  @Patch(':id/reset')
  @ApiOperation({ summary: 'Reset a match to suggested' })
  resetToSuggested(@Param('id') id: string) {
    return this.shortlistService.resetToSuggested(id);
  }

  @Delete('user/:matchedUserId')
  @ApiOperation({ summary: 'Remove a profile from shortlist' })
  @ApiResponse({ status: 200, description: 'Profile removed from shortlist' })
  removeShortlist(@Request() req: any,@Param('matchedUserId') matchedUserId: string) {
    return this.shortlistService.deShortlistUser(req.user.id, matchedUserId);
  }

}
