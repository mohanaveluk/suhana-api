import { Body, Controller, Get, Patch, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiResponse, ApiTags } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { AuditEmitter } from 'src/modules/audit/audit.emitter';
import { AuditEventType } from 'src/modules/audit/enums/audit-event-type.enum';
import { AuditEntityType } from 'src/modules/audit/enums/audit-entity-type.enum';
import { AppSettingsService } from '../app-settings/app-settings.service';
import { APP_SETTING } from '../app-settings/app-settings.keys';
import { SmsService } from './sms.service';

export class UpdateSmsSettingsDto {
  @ApiProperty({ description: 'Site-wide SMS switch. false = no text messages are sent.' })
  @IsBoolean()
  enabled: boolean;
}

export class SmsSettingsDto {
  @ApiProperty({ description: 'Admin switch (app_settings.sms_sending_enabled)' })
  sendingEnabled: boolean;
  @ApiProperty({ description: 'A provider is configured on this server (TELNYX_ENABLED + credentials, or dev log-only)' })
  providerConfigured: boolean;
  @ApiProperty({ nullable: true, enum: ['telnyx', 'log'], description: "'log' = development log-only, nothing is really sent" })
  provider: string | null;
  @ApiProperty({ description: 'Texts actually go out right now (switch on AND real provider configured)' })
  effective: boolean;
  @ApiProperty({ nullable: true })
  updatedBy: string | null;
  @ApiProperty({ nullable: true })
  updatedAt: Date | null;
}

/** GET/PATCH /api/v1/admin/settings/sms — site-wide SMS on/off, no deploy needed. Admin only. */
@ApiTags('[Admin] Settings')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('admin/settings/sms')
export class AdminSmsSettingsController {
  constructor(
    private readonly settings: AppSettingsService,
    private readonly sms: SmsService,
    private readonly audit: AuditEmitter,
  ) {}

  @Get()
  @ApiOperation({ summary: '[Admin] SMS sending status' })
  @ApiResponse({ status: 200, type: SmsSettingsDto })
  getStatus(): Promise<SmsSettingsDto> {
    return this.status();
  }

  @Patch()
  @ApiOperation({
    summary: '[Admin] Turn SMS sending on/off site-wide',
    description: 'Off: no text messages are sent. Login / password-reset codes go by email; mobile verification is unavailable. ' +
      'Applies on every server instance within ~30 seconds.',
  })
  @ApiResponse({ status: 200, type: SmsSettingsDto })
  async update(@Body() dto: UpdateSmsSettingsDto, @Req() req: any): Promise<SmsSettingsDto> {
    const userId: string | null = req.user?.id ?? null;
    const value = dto.enabled ? 'true' : 'false';
    const previous = await this.settings.set(APP_SETTING.SMS_SENDING_ENABLED, value, userId);
    if (previous !== value) {
      this.audit.emit({
        eventType: AuditEventType.SYSTEM_SETTING_CHANGED,
        entityType: AuditEntityType.SYSTEM_SETTING,
        entityId: APP_SETTING.SMS_SENDING_ENABLED,
        userId: userId ?? undefined,
        oldValue: { smsSendingEnabled: previous === 'true' },
        newValue: { smsSendingEnabled: dto.enabled },
        description: `SMS sending turned ${dto.enabled ? 'ON' : 'OFF'} site-wide`,
        ipAddress: req.ip,
        userAgent: req.headers?.['user-agent'],
      });
    }
    return this.status();
  }

  private async status(): Promise<SmsSettingsDto> {
    const rec = await this.settings.getRecord(APP_SETTING.SMS_SENDING_ENABLED);
    const sendingEnabled = rec.value.trim().toLowerCase() === 'true';
    return {
      sendingEnabled,
      providerConfigured: this.sms.isConfigured,
      provider: this.sms.providerName,
      effective: sendingEnabled && this.sms.canDeliver,
      updatedBy: rec.updatedBy,
      updatedAt: rec.updatedAt,
    };
  }
}
