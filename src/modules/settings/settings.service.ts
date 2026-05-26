import { Injectable, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserSettings } from './entity/user-settings.entity';
import { NotificationsDto, PrivacyDto, UpdateSettingsDto } from './dto/settings.dto';
import { User } from '../user/entity/user.entity';

@Injectable()
export class SettingsService {
  constructor(
    @InjectRepository(UserSettings)
    private readonly settingsRepo: Repository<UserSettings>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  // ── Helpers ────────────────────────────────────────────────────────────────

  /**
   * Returns existing settings row or creates one with defaults for this user.
   */
  private async findOrCreate(userId: string): Promise<UserSettings> {
    let settings = await this.settingsRepo.findOne({ where: { userId } });
    if (!settings) {
      settings = this.settingsRepo.create({ userId });
      settings = await this.settingsRepo.save(settings);
    }
    return settings;
  }

  private toResponse(settings: UserSettings) {
    return {
      notifications: {
        emailMatches:   settings.emailMatches,
        emailMessages:  settings.emailMessages,
        emailInterests: settings.emailInterests,
        emailMarketing: settings.emailMarketing,
        smsAlerts:      settings.smsAlerts,
        pushMatches:    settings.pushMatches,
        pushMessages:   settings.pushMessages,
      },
      privacy: {
        showOnlineStatus:  settings.showOnlineStatus,
        showReadReceipts:  settings.showReadReceipts,
        profileIndexed:    settings.profileIndexed,
        allowMessageFrom:  settings.allowMessageFrom,
      },
      updatedAt: settings.updatedAt,
    };
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  async getSettings(userId: string) {
    try {
      const settings = await this.findOrCreate(userId);
      return this.toResponse(settings);
    } catch (err) {
      throw new InternalServerErrorException('Failed to fetch settings');
    }
  }

  async updateSettings(userId: string, dto: UpdateSettingsDto) {
    try {
      const settings = await this.findOrCreate(userId);

      if (dto.notifications) {
        Object.assign(settings, dto.notifications);
      }
      if (dto.privacy) {
        Object.assign(settings, dto.privacy);
      }

      const saved = await this.settingsRepo.save(settings);
      return this.toResponse(saved);
    } catch (err) {
      throw new InternalServerErrorException('Failed to update settings');
    }
  }

  async updateNotifications(userId: string, dto: NotificationsDto) {
    try {
      const settings = await this.findOrCreate(userId);
      Object.assign(settings, dto);
      const saved = await this.settingsRepo.save(settings);
      return this.toResponse(saved);
    } catch (err) {
      throw new InternalServerErrorException('Failed to update notification settings');
    }
  }

  async updatePrivacy(userId: string, dto: PrivacyDto) {
    try {
      const settings = await this.findOrCreate(userId);
      Object.assign(settings, dto);
      const saved = await this.settingsRepo.save(settings);
      return this.toResponse(saved);
    } catch (err) {
      throw new InternalServerErrorException('Failed to update privacy settings');
    }
  }

  // ── Account Actions ────────────────────────────────────────────────────────

  async deactivateAccount(userId: string) {
    try {
      const user = await this.userRepo.findOne({ where: { id: userId } });
      if (!user) throw new NotFoundException('User not found');

      user.is_active = 0;
      await this.userRepo.save(user);

      return { message: 'Account deactivated successfully. You can reactivate at any time.' };
    } catch (err) {
      if (err instanceof NotFoundException) throw err;
      throw new InternalServerErrorException('Failed to deactivate account');
    }
  }

  async deleteAccount(userId: string) {
    try {
      const user = await this.userRepo.findOne({ where: { id: userId } });
      if (!user) throw new NotFoundException('User not found');

      user.is_active = 0;
      user.is_deleted = true;
      await this.userRepo.save(user);

      return { message: 'Account deleted successfully.' };
    } catch (err) {
      if (err instanceof NotFoundException) throw err;
      throw new InternalServerErrorException('Failed to delete account');
    }
  }
}
