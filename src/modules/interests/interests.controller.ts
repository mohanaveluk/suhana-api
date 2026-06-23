import { Body, Controller, Get, Param, Patch, Post, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { Public } from 'src/common/decorators/public.decorator';
import { SendInterestDto } from './dto/interest.dto';
import { InterestsService } from './interests.service';

@ApiTags('interests')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('interests')
export class InterestsController {
  constructor(private readonly interestsService: InterestsService) {}

  @Patch(':interestId/accept/:guid')
  @Public()
  @ApiOperation({ summary: 'Accept an interest request via email link (no auth required)' })
  @ApiParam({ name: 'interestId', description: 'Interest UUID from the email link' })
  @ApiParam({ name: 'guid', description: 'One-time GUID from the email link' })
  @ApiResponse({ status: 200, description: 'Interest accepted successfully', schema: { example: { success: true, message: 'Interest accepted successfully', requesterName: 'Priya Sharma', requesterUserId: 'uuid-...' } } })
  @ApiResponse({ status: 200, description: 'Invalid or already accepted', schema: { example: { success: false, message: 'Invalid or expired link' } } })
  acceptViaLink(
    @Param('interestId') interestId: string,
    @Param('guid') guid: string,
  ) {
    return this.interestsService.acceptViaLink(interestId, guid);
  }

  @Get('received')
  @ApiOperation({ summary: 'Get all interests received by the current user' })
  @ApiResponse({ status: 200, description: 'List of received interests' })
  getReceived(@Request() req: any) {
    return this.interestsService.getReceived(req.user.id);
  }

  @Get('sent')
  @ApiOperation({ summary: 'Get all interests sent by the current user' })
  @ApiResponse({ status: 200, description: 'List of sent interests' })
  getSent(@Request() req: any) {
    return this.interestsService.getSent(req.user.id);
  }

  @Post('send')
  @ApiOperation({ summary: 'Send interest to another user' })
  @ApiResponse({ status: 201, description: 'Interest sent successfully' })
  @ApiResponse({ status: 400, description: 'Interest already sent or invalid request' })
  send(@Request() req: any, @Body() dto: SendInterestDto) {
    const domain = `${req.get('origin')}`; 
    return this.interestsService.send(req.user.id, dto.toUserId, dto.message, domain);
  }

  @Patch(':id/accept')
  @ApiOperation({ summary: 'Accept a received interest' })
  @ApiResponse({ status: 200, description: 'Interest accepted' })
  @ApiResponse({ status: 403, description: 'Interest not addressed to you' })
  accept(@Param('id') id: string, @Request() req: any) {
    return this.interestsService.accept(id, req.user.id);
  }

  @Patch(':id/decline')
  @ApiOperation({ summary: 'Decline a received interest' })
  @ApiResponse({ status: 200, description: 'Interest declined' })
  @ApiResponse({ status: 403, description: 'Interest not addressed to you' })
  decline(@Param('id') id: string, @Request() req: any) {
    return this.interestsService.decline(id, req.user.id);
  }
}
