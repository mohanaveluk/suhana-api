import { Controller, Get, Post, Param, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { PremiumService } from './premium.service';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';

@ApiTags('premium')
@Controller('premium')
export class PremiumController {
  constructor(private readonly premiumService: PremiumService) {}

  @Get('plans')
  @ApiOperation({ summary: 'Get all premium plans' })
  @ApiResponse({ status: 200, description: 'List of premium plans' })
  getPlans() {
    return this.premiumService.getPlans();
  }

  @Get('plans/:id')
  @ApiOperation({ summary: 'Get premium plan by ID' })
  @ApiResponse({ status: 200, description: 'Plan details' })
  getPlanById(@Param('id') id: string) {
    return this.premiumService.getPlanById(id);
  }

  @Post('subscribe/:planId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Subscribe to a premium plan' })
  @ApiResponse({ status: 201, description: 'Subscription successful' })
  subscribe(@Request() req: any, @Param('planId') planId: string) {
    return this.premiumService.subscribe(req.user.id, planId);
  }
}
