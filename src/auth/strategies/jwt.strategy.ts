import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from 'src/users/entities/user.entity';
import { CurrentJwtUser, JwtPayload } from '../types';
import { AuthSession } from '../entities/auth-session.entity';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    @InjectRepository(User) private readonly usersRepo: Repository<User>,
    @InjectRepository(AuthSession)
    private readonly authSessionsRepo: Repository<AuthSession>,
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
      throw new UnauthorizedException('Token de usuario inválido.');
    }

    if (
      user.role === 'TENANT_ADMIN' &&
      (!user.tenant_id || !user.tenant || !user.tenant.is_active || !user.email_verified_at)
    ) {
      throw new UnauthorizedException('Contexto del negocio inválido.');
    }

    if (
      typeof payload.token_version === 'number' &&
      payload.token_version !== user.token_version
    ) {
      throw new UnauthorizedException('Versión de token inválida.');
    }

    const sessionId =
      typeof payload.sid === 'string' && payload.sid.trim()
        ? payload.sid.trim()
        : null;

    if (sessionId) {
      const session = await this.authSessionsRepo.findOne({
        where: { id: sessionId, user_id: user.id },
      });

      if (!session || session.revoked_at || session.expires_at.getTime() <= Date.now()) {
        throw new UnauthorizedException('Sesión de autenticación inválida.');
      }
    }

    return {
      sub: user.id,
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      tenant_id: user.tenant_id ?? null,
      tenant_dashboard_tour_completed_at: user.tenant_dashboard_tour_completed_at ?? null,
      session_id: sessionId,
      token_version: user.token_version,
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
