import {
  Controller, Get, Patch, Body, Request, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import {
  ApiTags, ApiOperation, ApiResponse, ApiBearerAuth,
} from '@nestjs/swagger';
import { SettingsService } from './settings.service';
import { NotificationsDto, PrivacyDto, UpdateSettingsDto } from './dto/settings.dto';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';

@ApiTags('settings')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  // GET /settings/me
  @Get('me')
  @ApiOperation({ summary: 'Get current user settings (notifications + privacy)' })
  @ApiResponse({ status: 200, description: 'Settings returned' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  getSettings(@Request() req: any) {
    return this.settingsService.getSettings(req.user.id);
  }

  // PATCH /settings/me  — update both sections at once
  @Patch('me')
  @ApiOperation({ summary: 'Update all settings (notifications + privacy)' })
  @ApiResponse({ status: 200, description: 'Settings updated' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  updateSettings(@Request() req: any, @Body() dto: UpdateSettingsDto) {
    return this.settingsService.updateSettings(req.user.id, dto);
  }

  // PATCH /settings/me/notifications  — granular update
  @Patch('me/notifications')
  @ApiOperation({ summary: 'Update notification preferences only' })
  @ApiResponse({ status: 200, description: 'Notification settings updated' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  updateNotifications(@Request() req: any, @Body() dto: NotificationsDto) {
    return this.settingsService.updateNotifications(req.user.id, dto);
  }

  // PATCH /settings/me/privacy  — granular update
  @Patch('me/privacy')
  @ApiOperation({ summary: 'Update privacy & visibility settings only' })
  @ApiResponse({ status: 200, description: 'Privacy settings updated' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  updatePrivacy(@Request() req: any, @Body() dto: PrivacyDto) {
    return this.settingsService.updatePrivacy(req.user.id, dto);
  }

  // PATCH /settings/me/deactivate
  @Patch('me/deactivate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Deactivate account — sets is_active to 0. Can be reactivated.' })
  @ApiResponse({ status: 200, description: 'Account deactivated' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  deactivateAccount(@Request() req: any) {
    return this.settingsService.deactivateAccount(req.user.id);
  }

  // PATCH /settings/me/delete
  @Patch('me/delete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete account — sets is_active to 0 and is_email_verified to false.' })
  @ApiResponse({ status: 200, description: 'Account deleted' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  deleteAccount(@Request() req: any) {
    return this.settingsService.deleteAccount(req.user.id);
  }
}
