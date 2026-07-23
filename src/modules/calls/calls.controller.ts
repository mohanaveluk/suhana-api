import { Body, Controller, Get, Param, Post, Query, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { CallsService } from './calls.service';
import { InitiateCallDto } from './dto/call.dto';

@ApiTags('calls')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('calls')
export class CallsController {
  constructor(private readonly callsService: CallsService) {}

  @Post('initiate')
  @ApiOperation({ summary: 'Create a call record (audio or video). Real-time ringing is driven by the /calls Socket.IO gateway.' })
  @ApiResponse({ status: 201, description: 'Call initiated' })
  initiate(@Request() req: any, @Body() dto: InitiateCallDto) {
    return this.callsService.initiate(req.user.id, dto.conversationId, dto.type);
  }

  @Get('history')
  @ApiOperation({ summary: 'Get call history, optionally filtered by conversation' })
  @ApiResponse({ status: 200, description: 'Call history' })
  @ApiQuery({ name: 'conversationId', required: false })
  getHistory(@Request() req: any, @Query('conversationId') conversationId?: string) {
    return this.callsService.getHistory(req.user.id, conversationId);
  }

  @Get('missed')
  @ApiOperation({ summary: 'Get missed calls for the current user' })
  @ApiResponse({ status: 200, description: 'Missed calls' })
  getMissed(@Request() req: any) {
    return this.callsService.getMissed(req.user.id);
  }

  @Post(':id/accept')
  @ApiOperation({ summary: 'Accept a ringing call' })
  @ApiResponse({ status: 200, description: 'Call accepted' })
  @ApiResponse({ status: 403, description: 'Only the receiver can accept the call' })
  accept(@Param('id') id: string, @Request() req: any) {
    return this.callsService.accept(id, req.user.id);
  }

  @Post(':id/decline')
  @ApiOperation({ summary: 'Decline a ringing call' })
  @ApiResponse({ status: 200, description: 'Call declined' })
  @ApiResponse({ status: 403, description: 'Only the receiver can decline the call' })
  decline(@Param('id') id: string, @Request() req: any) {
    return this.callsService.decline(id, req.user.id);
  }

  @Post(':id/end')
  @ApiOperation({ summary: 'End a call (either participant may end it)' })
  @ApiResponse({ status: 200, description: 'Call ended' })
  @ApiResponse({ status: 403, description: 'Only a call participant can end the call' })
  end(@Param('id') id: string, @Request() req: any) {
    return this.callsService.end(id, req.user.id);
  }
}
