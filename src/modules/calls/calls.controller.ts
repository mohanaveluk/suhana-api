import { Body, Controller, Get, Param, Patch, Post, Query, Request, UseGuards } from '@nestjs/common';
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
  @ApiOperation({ summary: 'Initiate a call (audio or video)' })
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

  @Patch(':id/end')
  @ApiOperation({ summary: 'End a call' })
  @ApiResponse({ status: 200, description: 'Call ended' })
  @ApiResponse({ status: 403, description: 'Only the initiator can end the call' })
  end(@Param('id') id: string, @Request() req: any) {
    return this.callsService.end(id, req.user.id);
  }
}
