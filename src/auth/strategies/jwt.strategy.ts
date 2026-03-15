import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from 'src/users/entities/user.entity';
import { CurrentJwtUser, JwtPayload } from '../types';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    @InjectRepository(User) private readonly usersRepo: Repository<User>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: config.get<string>('JWT_SECRET'),
    });
  }

  // Esto termina en req.user
  async validate(payload: JwtPayload): Promise<CurrentJwtUser> {
    const user = await this.usersRepo.findOne({
      where: { id: payload.sub },
      relations: { tenant: true },
    });

    if (!user || !user.is_active) {
      throw new UnauthorizedException('Invalid token user');
    }

    if (
      user.role === 'TENANT_ADMIN' &&
      (!user.tenant_id || !user.tenant || !user.tenant.is_active)
    ) {
      throw new UnauthorizedException('Invalid tenant context');
    }

    return {
      sub: user.id,
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      tenant_id: user.tenant_id ?? null,
      is_active: user.is_active,
      tenant: user.tenant
        ? {
            id: user.tenant.id,
            name: user.tenant.name,
            slug: user.tenant.slug,
            is_active: user.tenant.is_active,
          }
        : null,
    };
  }
}
