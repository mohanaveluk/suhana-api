import { Controller, Get, Query, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { ListInteractionsQueryDto } from './dto/member-interactions.dto';
import { MemberInteractionsService } from './member-interactions.service';

/**
 * "My Interests" read API. Always scoped to the authenticated member (no user id is ever taken from
 * the request). Status changes stay on the existing /interests endpoints
 * (accept · decline · withdraw · read · send), so the business rules live in one place.
 */
@ApiTags('member-interactions')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('member-interactions')
export class MemberInteractionsController {
  constructor(private readonly service: MemberInteractionsService) {}

  // GET /member-interactions/dashboard
  @Get('dashboard')
  @ApiOperation({ summary: 'My Interests summary counts (new, pending, accepted, profile views, unread messages…)' })
  @ApiResponse({ status: 200, description: 'Counts for the signed-in member' })
  dashboard(@Request() req: any) {
    return this.service.dashboard(req.user.id);
  }

  // GET /member-interactions
  @Get()
  @ApiOperation({ summary: 'Received interests, profile views and messages (or sent interests) with compatibility' })
  @ApiResponse({ status: 200, description: 'Paginated interaction list' })
  list(@Request() req: any, @Query() query: ListInteractionsQueryDto) {
    return this.service.list(req.user.id, query);
  }
}
