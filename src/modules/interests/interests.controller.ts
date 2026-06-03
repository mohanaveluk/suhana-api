import { Body, Controller, Get, Param, Patch, Post, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { SendInterestDto } from './dto/interest.dto';
import { InterestsService } from './interests.service';

@ApiTags('interests')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('interests')
export class InterestsController {
  constructor(private readonly interestsService: InterestsService) {}

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
    return this.interestsService.send(req.user.id, dto.toUserId, dto.message);
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
