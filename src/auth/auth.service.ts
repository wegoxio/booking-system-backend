import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LoginDto } from './dto/login.dto';
import { Tenant } from 'src/tenant/entities/tenant.entity';
import { User } from 'src/users/entities/user.entity';

@Injectable()
export class AuthService {
  constructor(
    private jwt: JwtService,
    @InjectRepository(User) private usersRepo: Repository<User>,
    @InjectRepository(Tenant) private tenantsRepo: Repository<Tenant>,
  ) {}

  async login(dto: LoginDto) {
    const email = dto.email.toLowerCase().trim();

    const user = await this.usersRepo.findOne({ where: { email } });
    if (!user) throw new UnauthorizedException('Credenciales Invalidas.');

    if (!user.is_active) throw new ForbiddenException('Credenciales Invalidas.');

    const ok = await argon2.verify(user.password_hash, dto.password);
    if (!ok) throw new UnauthorizedException('Credenciales Invalidas.');

    // Si es TENANT_ADMIN, validar que el tenant exista y esté activo
    if (user.role === 'TENANT_ADMIN') {
      if (!user.tenant_id) {
        // Esto sería inconsistencia de datos: TENANT_ADMIN sin tenant
        throw new ForbiddenException('Tenant context missing');
      }

      const tenant = await this.tenantsRepo.findOne({ where: { id: user.tenant_id } });
      if (!tenant) throw new ForbiddenException('Tenant not found');

      if (tenant.status !== 'ACTIVE') {
        throw new ForbiddenException('Tenant disabled');
      }
    }

    const payload = {
      sub: user.id,
      role: user.role,
      tenant_id: user.tenant_id ?? null,
    };

    return {
      access_token: this.jwt.sign(payload),
    };
  }
}