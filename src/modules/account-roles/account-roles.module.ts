import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../user/entity/user.entity';
import { RoleEntity } from '../user/entity/roles.entity';
import { UserAccountRole } from './entities/user-account-role.entity';
import { AuthHandoffCode } from './entities/auth-handoff-code.entity';
import { AccountRolesService } from './account-roles.service';

/** Global so guards, the JWT strategy and any module can read/grant roles. */
@Global()
@Module({
  imports: [TypeOrmModule.forFeature([UserAccountRole, AuthHandoffCode, User, RoleEntity])],
  providers: [AccountRolesService],
  exports: [AccountRolesService],
})
export class AccountRolesModule {}
