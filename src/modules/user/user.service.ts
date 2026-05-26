/*
https://docs.nestjs.com/providers#services
*/

import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserRepository } from './user.repository';
import { User } from './entity';
import { RoleEntity } from './entity/roles.entity';

@Injectable()
export class UserService {
    constructor(
        private readonly userRepository: UserRepository,
        @InjectRepository(User)
        private readonly userRepo: Repository<User>,
        @InjectRepository(RoleEntity)
        private readonly rolsepository: Repository<RoleEntity>
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

}
