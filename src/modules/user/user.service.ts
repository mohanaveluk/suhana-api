/*
https://docs.nestjs.com/providers#services
*/

import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserRepository } from './user.repository';
import { User, UserBlock, UserReport } from './entity';
import { RoleEntity } from './entity/roles.entity';
import { Membership } from './enums/profile-status.enum';

@Injectable()
export class UserService {
    constructor(
        private readonly userRepository: UserRepository,
        @InjectRepository(User)
        private readonly userRepo: Repository<User>,
        @InjectRepository(RoleEntity)
        private readonly rolsepository: Repository<RoleEntity>,
        @InjectRepository(UserBlock)
        private readonly blockRepo: Repository<UserBlock>,
        @InjectRepository(UserReport)
        private readonly reportRepo: Repository<UserReport>,
    ){    }

    async validateAccount(uniqueId) {
        try {
            const userResponse = await this.userRepository.validateAccount(uniqueId);
            if (userResponse === 'success') {
                return userResponse;
            }
            else {
                throw new NotFoundException('User not found');
            }

        } catch (error) {
            throw new NotFoundException('Failed to get user');
        }
    }

    async findAll() {
    return this.userRepo.find({ relations: ['profile', 'profile.photos'] });
  }

  async findById(id: string) {
    const user = await this.userRepo.findOne({
      where: { id },
      relations: ['profile', 'profile.photos'],
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async findByEmail(email: string) {
    const user = await this.userRepo.findOne({
      where: { email },
      relations: ['profile', 'profile.photos'],
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async updateMembership(id: string, membership: string) {
    const user = await this.findById(id);
    user.membership = membership;
    return this.userRepo.save(user);
  }

  async updateRole(id: string, role: string) {
    const user = await this.findById(id);
    const roleEntity = await this.rolsepository.findOne({ where: { name: role } });
    if (!roleEntity) throw new NotFoundException('Role not found');
    user.role_id = roleEntity.id;
    return this.userRepo.save(user);
  }

  async deleteUser(id: string) {
    const result = await this.userRepo.delete(id);
    if (result.affected === 0) throw new NotFoundException('User not found');
    return { message: 'User deleted successfully' };
  }

  async heartbeat(userId: string) {
    await this.userRepo.update({ id: userId }, { last_active: new Date() });
    return { online: true };
  }

  async getStatus(userId: string) {
    const user = await this.userRepo.findOne({ where: { id: userId }, select: ['id', 'last_active'] });
    if (!user) throw new NotFoundException('User not found');
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const isOnline = user.last_active ? user.last_active > fiveMinutesAgo : false;
    return { userId, isOnline, lastActive: user.last_active };
  }

  async getPhone(userId: string, targetUserId: string) {
    const loggedUser = await this.userRepo.findOne({ where: { id: userId } });
    if (!loggedUser) throw new NotFoundException('User not found');

    if (loggedUser.membership != Membership.PLATINUM && loggedUser.membership != Membership.GOLD) {
      throw new ConflictException("Phone number available for gold and platinum  members only");
    }

    const user = await this.userRepo.findOne({ where: { id: targetUserId }, select: ['id', 'mobile'] });
    if (!user) throw new NotFoundException('User not found');
    return { userId: targetUserId, mobile: user.mobile };
  }

  async blockUser(blockedByUserId: string, blockedUserId: string) {
    if (blockedByUserId === blockedUserId) throw new BadRequestException('Cannot block yourself');
    const existing = await this.blockRepo.findOne({ where: { blockedByUserId, blockedUserId } });
    if (existing) return { status: 'error', message: 'User already blocked' };
    const block = this.blockRepo.create({ blockedByUserId, blockedUserId });
    await this.blockRepo.save(block);
    return { status: 'success', message: 'User blocked successfully' };
  }

  async reportUser(reportedByUserId: string, reportedUserId: string, reason: string) {
    if (reportedByUserId === reportedUserId) throw new BadRequestException('Cannot report yourself');
    if (!reason?.trim()) throw new BadRequestException('Reason is required');
    const reportedUser = await this.reportRepo.findOne({ where: { reportedUserId } });
    if (reportedUser) return { status: 'error', message: 'User reported already!' };
    const report = this.reportRepo.create({ reportedByUserId, reportedUserId, reason: reason.trim() });
    await this.reportRepo.save(report);
    return { status: 'success', message: 'Report submitted. Our team will review it shortly.' };
  }

}
