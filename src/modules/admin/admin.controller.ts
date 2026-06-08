import { Controller, Get, Patch, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';

@ApiTags('admin')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Get admin dashboard statistics' })
  @ApiResponse({ status: 200, description: 'Dashboard statistics' })
  getStats() {
    return this.adminService.getStats();
  }

  @Get('users')
  @ApiOperation({ summary: 'Get all users for admin management' })
  @ApiResponse({ status: 200, description: 'List of all users with profile summary' })
  getAllUsers() {
    return this.adminService.getAllUsers();
  }

  @Patch('users/:id/status')
  @ApiOperation({ summary: 'Update user profile status (active, blocked, reported, etc.)' })
  updateUserStatus(@Param('id') id: string, @Body('status') status: string) {
    return this.adminService.updateUserStatus(id, status);
  }

  @Get('analytics/matches')
  @ApiOperation({ summary: 'Get monthly match analytics' })
  @ApiResponse({ status: 200, description: 'Monthly match count data' })
  getMatchAnalytics() {
    return this.adminService.getMatchAnalytics();
  }

  @Get('analytics/registrations')
  @ApiOperation({ summary: 'Get monthly registration trends' })
  @ApiResponse({ status: 200, description: 'Monthly registration count data' })
  getRegistrationTrends() {
    return this.adminService.getRegistrationTrends();
  }

  @Get('match-weights')
  @ApiOperation({ summary: 'Get current match algorithm weights' })
  getMatchWeights() {
    return this.adminService.getMatchWeights();
  }

  @Patch('match-weights')
  @ApiOperation({ summary: 'Update match algorithm weights' })
  updateMatchWeights(@Body() weights: Record<string, number>) {
    return this.adminService.updateMatchWeights(weights);
  }
}
