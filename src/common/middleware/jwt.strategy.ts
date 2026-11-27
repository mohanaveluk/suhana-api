import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';
import { AccountRolesService } from 'src/modules/account-roles/account-roles.service';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { RoleEntity } from 'src/modules/user/entity/roles.entity';
import { User } from 'src/modules/user/entity/user.entity';
//import { Role } from 'src/entities/user/roles.entity';
//import { User } from 'src/entities/user/user.entity';
import { Repository } from 'typeorm';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(RoleEntity)
    private roleRepository: Repository<RoleEntity>,
    private readonly accountRoles: AccountRolesService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'your-secret-key',
      passReqToCallback: false
    });
  }

  async validate(payload: any) {
    
    const user = await this.userRepository.findOne({
      where: { id: payload.sub }
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const role = await this.roleRepository.findOne({
      where: { id: user.role_id }
    });
    
    //const user = {email: "gcp@gmail.com", guid: "12345", first_name: "gcp", last_name: "study"};
    //const role = {name : "admin"};
    return {
      email: user.email,
      id: user.id,
      firstName: user.first_name,
      lastName: user.last_name,
      role: role !== null && role !== undefined ? role.name : '',
      // Where the account was first created (MEMBER | PROVIDER) — informational only.
      accountType: user.account_type ?? 'MEMBER',
      // Application roles, read from the DB on every request so grants/revokes apply at once.
      // JwtAuthGuard / AppRolesGuard authorise with these (MEMBER, PROVIDER, PROVIDER_STAFF, ADMIN…).
      roles: await this.accountRoles.effectiveRoles(user, role?.name ?? null),
    };
  }
}

