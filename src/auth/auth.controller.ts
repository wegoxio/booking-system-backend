import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { CompleteMfaLoginDto, VerifyMfaCodeDto } from './dto/mfa.dto';
import { JwtAuthGuard } from './guards/jwt.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { Request, Response } from 'express';
import type {
  AuthAccessTokenResponse,
  AuthLoginResponse,
  CurrentJwtUser,
} from './types';
import { Throttle } from '@nestjs/throttler';
import { AuthCookieService } from './auth-cookie.service';
import { TurnstileService } from '../captcha/turnstile.service';
import { ConfigService } from '@nestjs/config';
import { AccountAccessService } from './account-access.service';
import { RequestPasswordResetDto } from './dto/request-password-reset.dto';
import { ResolvePasswordResetDto } from './dto/resolve-password-reset.dto';
import { CompletePasswordResetDto } from './dto/complete-password-reset.dto';
import { ResolveTenantAdminOnboardingDto } from './dto/resolve-tenant-admin-onboarding.dto';
import { CompleteTenantAdminOnboardingDto } from './dto/complete-tenant-admin-onboarding.dto';
import { ApiBearerAuth, ApiCookieAuth, ApiTags } from '@nestjs/swagger';

@ApiTags('Auth')
@ApiBearerAuth('access-token')
@ApiCookieAuth('wegox_refresh')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly authCookieService: AuthCookieService,
    private readonly turnstileService: TurnstileService,
    private readonly configService: ConfigService,
    private readonly accountAccessService: AccountAccessService,
  ) {}

  @Post('login')
  @Throttle({ default: { limit: 8, ttl: 60_000 } })
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthLoginResponse> {
    await this.turnstileService.verifyOrThrow({
      token: dto.captcha_token,
      ip: req.ip ?? null,
      expectedAction: this.configService.get<string>(
        'TURNSTILE_LOGIN_ACTION',
        'login',
      ),
    });

    const tokens = await this.authService.login(dto, {
      ip: req.ip ?? null,
      user_agent: req.headers['user-agent'] ?? null,
    });

    if ('mfa_required' in tokens) {
      return tokens;
    }

    this.authCookieService.setAuthCookies(
      res,
      tokens.refresh_token,
      tokens.refresh_expires_at,
      tokens.csrf_token,
    );

    return { access_token: tokens.access_token };
  }

  @Post('login/mfa')
  @Throttle({ default: { limit: 8, ttl: 60_000 } })
  async completeMfaLogin(
    @Body() dto: CompleteMfaLoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthAccessTokenResponse> {
    const tokens = await this.authService.completeMfaLogin(
      dto.challenge_token,
      dto.code,
      dto.recovery_code,
      {
        ip: req.ip ?? null,
        user_agent: req.headers['user-agent'] ?? null,
      },
    );

    this.authCookieService.setAuthCookies(
      res,
      tokens.refresh_token,
      tokens.refresh_expires_at,
      tokens.csrf_token,
    );

    return { access_token: tokens.access_token };
  }

  @Post('refresh')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthAccessTokenResponse> {
    const refreshToken =
      this.authCookieService.readRefreshTokenFromRequest(req);
    if (!refreshToken) {
      throw new UnauthorizedException('Sesión inválida.');
    }
    const csrfToken = this.authCookieService.assertCsrfToken(req);

    const tokens = await this.authService.refresh(refreshToken, csrfToken, {
      ip: req.ip ?? null,
      user_agent: req.headers['user-agent'] ?? null,
    });

    this.authCookieService.setAuthCookies(
      res,
      tokens.refresh_token,
      tokens.refresh_expires_at,
      tokens.csrf_token,
    );

    return { access_token: tokens.access_token };
  }

  @Post('logout')
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const refreshToken =
      this.authCookieService.readRefreshTokenFromRequest(req);
    if (!refreshToken) {
      this.authCookieService.clearAuthCookies(res);
      return { success: true };
    }
    const csrfToken = this.authCookieService.assertCsrfToken(req);

    try {
      return await this.authService.logout(refreshToken, csrfToken, {
        ip: req.ip ?? null,
        user_agent: req.headers['user-agent'] ?? null,
      });
    } finally {
      this.authCookieService.clearAuthCookies(res);
    }
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout-all')
  @Throttle({ default: { limit: 8, ttl: 60_000 } })
  async logoutAll(
    @CurrentUser() user: CurrentJwtUser,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    this.authCookieService.clearAuthCookies(res);

    return this.authService.logoutAll(user, {
      ip: req.ip ?? null,
      user_agent: req.headers['user-agent'] ?? null,
    });
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@CurrentUser() user: CurrentJwtUser) {
    return user;
  }

  @UseGuards(JwtAuthGuard)
  @Get('mfa/status')
  getMfaStatus(@CurrentUser() user: CurrentJwtUser) {
    return this.authService.getMfaStatus(user);
  }

  @UseGuards(JwtAuthGuard)
  @Post('mfa/setup')
  @Throttle({ default: { limit: 6, ttl: 60_000 } })
  startMfaSetup(@CurrentUser() user: CurrentJwtUser) {
    return this.authService.startMfaSetup(user);
  }

  @UseGuards(JwtAuthGuard)
  @Post('mfa/enable')
  @Throttle({ default: { limit: 8, ttl: 60_000 } })
  enableMfa(
    @CurrentUser() user: CurrentJwtUser,
    @Body() dto: VerifyMfaCodeDto,
    @Req() req: Request,
  ) {
    return this.authService.enableMfa(user, dto.code, {
      ip: req.ip ?? null,
      user_agent: req.headers['user-agent'] ?? null,
    });
  }

  @UseGuards(JwtAuthGuard)
  @Post('mfa/disable')
  @Throttle({ default: { limit: 8, ttl: 60_000 } })
  disableMfa(
    @CurrentUser() user: CurrentJwtUser,
    @Body() dto: VerifyMfaCodeDto,
    @Req() req: Request,
  ) {
    return this.authService.disableMfa(user, dto.code, dto.recovery_code, {
      ip: req.ip ?? null,
      user_agent: req.headers['user-agent'] ?? null,
    });
  }

  @UseGuards(JwtAuthGuard)
  @Post('mfa/recovery-codes/regenerate')
  @Throttle({ default: { limit: 6, ttl: 60_000 } })
  regenerateRecoveryCodes(
    @CurrentUser() user: CurrentJwtUser,
    @Body() dto: VerifyMfaCodeDto,
    @Req() req: Request,
  ) {
    return this.authService.regenerateRecoveryCodes(
      user,
      dto.code,
      dto.recovery_code,
      {
        ip: req.ip ?? null,
        user_agent: req.headers['user-agent'] ?? null,
      },
    );
  }

  @UseGuards(JwtAuthGuard)
  @Get('sessions')
  listSessions(@CurrentUser() user: CurrentJwtUser) {
    return this.authService.listSessions(user);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('sessions/:id')
  revokeSession(
    @CurrentUser() user: CurrentJwtUser,
    @Param('id', new ParseUUIDPipe()) sessionId: string,
    @Req() req: Request,
  ) {
    return this.authService.revokeSession(user, sessionId, {
      ip: req.ip ?? null,
      user_agent: req.headers['user-agent'] ?? null,
    });
  }

  @UseGuards(JwtAuthGuard)
  @Post('sessions/revoke-others')
  revokeOtherSessions(
    @CurrentUser() user: CurrentJwtUser,
    @Req() req: Request,
  ) {
    return this.authService.revokeOtherSessions(user, {
      ip: req.ip ?? null,
      user_agent: req.headers['user-agent'] ?? null,
    });
  }

  @UseGuards(JwtAuthGuard)
  @Post('me/tours/tenant-dashboard/complete')
  completeTenantDashboardTour(@CurrentUser() user: CurrentJwtUser) {
    return this.authService.markTenantDashboardTourCompleted(user);
  }

  @Post('password/forgot')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  forgotPassword(@Body() dto: RequestPasswordResetDto, @Req() req: Request) {
    return this.accountAccessService.requestPasswordRecovery(dto.email, {
      ip: req.ip ?? null,
      user_agent: req.headers['user-agent'] ?? null,
    });
  }

  @Post('password/reset/resolve')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  resolvePasswordReset(@Body() dto: ResolvePasswordResetDto) {
    return this.accountAccessService.resolvePasswordReset(dto.token);
  }

  @Post('password/reset/complete')
  @Throttle({ default: { limit: 8, ttl: 60_000 } })
  completePasswordReset(
    @Body() dto: CompletePasswordResetDto,
    @Req() req: Request,
  ) {
    return this.accountAccessService.completePasswordReset(
      {
        token: dto.token,
        password: dto.password,
      },
      {
        ip: req.ip ?? null,
        user_agent: req.headers['user-agent'] ?? null,
      },
    );
  }

  @Post('tenant-admin/onboarding/resolve')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  resolveTenantAdminOnboarding(@Body() dto: ResolveTenantAdminOnboardingDto) {
    return this.accountAccessService.resolveTenantAdminOnboarding(dto.token);
  }

  @Post('tenant-admin/onboarding/complete')
  @Throttle({ default: { limit: 8, ttl: 60_000 } })
  completeTenantAdminOnboarding(
    @Body() dto: CompleteTenantAdminOnboardingDto,
    @Req() req: Request,
  ) {
    return this.accountAccessService.completeTenantAdminOnboarding(
      {
        token: dto.token,
        name: dto.name,
        password: dto.password,
      },
      {
        ip: req.ip ?? null,
        user_agent: req.headers['user-agent'] ?? null,
      },
    );
  }
}
