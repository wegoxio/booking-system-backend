import { Module } from '@nestjs/common';
import { JwtModule, JwtModuleOptions, type JwtSignOptions } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { User } from 'src/users/entities/user.entity';
import { JwtStrategy } from './strategies/jwt.strategy';
import { AuditModule } from 'src/audit/audit.module';
import { AuthSession } from './entities/auth-session.entity';
import { AuthCookieService } from './auth-cookie.service';
import { CaptchaModule } from 'src/captcha/captcha.module';

type JwtExpiresIn = NonNullable<JwtSignOptions['expiresIn']>;

function toJwtExpiresIn(value: string | undefined, fallback: JwtExpiresIn): JwtExpiresIn {
  if (!value?.trim()) return fallback;
  const normalized = value.trim();
  if (/^\d+$/.test(normalized)) {
    return Number(normalized);
  }

  return normalized as JwtExpiresIn;
}


@Module({
  imports: [
    TypeOrmModule.forFeature([User, AuthSession]),
    AuditModule,
    CaptchaModule,
    PassportModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService): JwtModuleOptions => {
        const secret = config.get<string>('JWT_SECRET');
        const accessExpiresIn =
          config.get<string>('JWT_ACCESS_EXPIRES_IN') ?? config.get<string>('JWT_EXPIRES_IN');

        return {
          secret,
          signOptions: {
            expiresIn: toJwtExpiresIn(accessExpiresIn, '3600s'),
          },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, AuthCookieService, JwtStrategy],
})
export class AuthModule {}
