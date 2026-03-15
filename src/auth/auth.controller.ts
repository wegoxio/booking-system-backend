import {
    Body,
    Controller,
    Get,
    Post,
    Req,
    Res,
    UnauthorizedException,
    UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt.guard';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import type { Request, Response } from 'express';
import type { AuthAccessTokenResponse, CurrentJwtUser } from './types';
import { Throttle } from '@nestjs/throttler';
import { AuthCookieService } from './auth-cookie.service';
import { TurnstileService } from 'src/captcha/turnstile.service';
import { ConfigService } from '@nestjs/config';

@Controller('auth')
export class AuthController {
    constructor(
        private readonly authService: AuthService,
        private readonly authCookieService: AuthCookieService,
        private readonly turnstileService: TurnstileService,
        private readonly configService: ConfigService,
    ){}

    @Post('login')
    @Throttle({ default: { limit: 8, ttl: 60_000 } })
    async login(
        @Body() dto: LoginDto,
        @Req() req: Request,
        @Res({ passthrough: true }) res: Response,
    ): Promise<AuthAccessTokenResponse> {
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
        const refreshToken = this.authCookieService.readRefreshTokenFromRequest(req);
        if (!refreshToken) {
            throw new UnauthorizedException('Sesion invalida.');
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
    async logout(
        @Req() req: Request,
        @Res({ passthrough: true }) res: Response,
    ){
        const refreshToken = this.authCookieService.readRefreshTokenFromRequest(req);
        if (!refreshToken) {
            this.authCookieService.clearAuthCookies(res);
            return { success: true };
        }
        const csrfToken = this.authCookieService.assertCsrfToken(req);

        const result = await this.authService.logout(refreshToken, csrfToken, {
            ip: req.ip ?? null,
            user_agent: req.headers['user-agent'] ?? null,
        });

        this.authCookieService.clearAuthCookies(res);
        return result;
    }

    @UseGuards(JwtAuthGuard)
    @Post('logout-all')
    @Throttle({ default: { limit: 8, ttl: 60_000 } })
    async logoutAll(
        @CurrentUser() user: CurrentJwtUser,
        @Req() req: Request,
        @Res({ passthrough: true }) res: Response,
    ){
        this.authCookieService.clearAuthCookies(res);

        return this.authService.logoutAll(user, {
            ip: req.ip ?? null,
            user_agent: req.headers['user-agent'] ?? null,
        });
    }

    @UseGuards(JwtAuthGuard)
    @Get('me')
    me(@CurrentUser() user: CurrentJwtUser){
        return user;
    }
}
