import { ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'crypto';
import type { Request, Response } from 'express';

type RefreshCookieSameSite = 'lax' | 'strict' | 'none';

@Injectable()
export class AuthCookieService {
  private readonly refreshCookieName: string;
  private readonly refreshCookiePath: string;
  private readonly refreshCookieDomain: string | undefined;
  private readonly refreshCookieSameSite: RefreshCookieSameSite;
  private readonly refreshCookieSecure: boolean;
  private readonly csrfCookieName: string;
  private readonly csrfCookiePath: string;
  private readonly csrfHeaderName: string;

  constructor(private readonly configService: ConfigService) {
    const nodeEnv = this.configService.get<string>('NODE_ENV', 'development');
    const isProduction = nodeEnv === 'production';

    this.refreshCookieName = this.configService.get<string>(
      'AUTH_REFRESH_COOKIE_NAME',
      'weegox_refresh',
    );
    this.refreshCookiePath = this.configService.get<string>(
      'AUTH_REFRESH_COOKIE_PATH',
      '/api/auth',
    );
    const configuredDomain = this.configService
      .get<string>('AUTH_REFRESH_COOKIE_DOMAIN')
      ?.trim();
    this.refreshCookieDomain = configuredDomain ? configuredDomain : undefined;
    this.refreshCookieSameSite = this.configService.get<RefreshCookieSameSite>(
      'AUTH_REFRESH_COOKIE_SAME_SITE',
      'lax',
    );
    this.refreshCookieSecure = this.resolveCookieSecureValue(isProduction);
    this.csrfCookieName = this.configService.get<string>(
      'AUTH_CSRF_COOKIE_NAME',
      'weegox_csrf',
    );
    this.csrfCookiePath = this.configService.get<string>(
      'AUTH_CSRF_COOKIE_PATH',
      '/',
    );
    this.csrfHeaderName = this.configService
      .get<string>('AUTH_CSRF_HEADER_NAME', 'x-csrf-token')
      .trim()
      .toLowerCase();

    if (this.refreshCookieSameSite === 'none' && !this.refreshCookieSecure) {
      throw new Error(
        'AUTH_REFRESH_COOKIE_SAME_SITE=none requiere AUTH_REFRESH_COOKIE_SECURE=true',
      );
    }
  }

  readRefreshTokenFromRequest(req: Request): string | null {
    const value = req.cookies?.[this.refreshCookieName];
    if (typeof value !== 'string') return null;
    const token = value.trim();
    return token.length > 0 ? token : null;
  }

  readCsrfTokenFromRequest(req: Request): string | null {
    const value = req.cookies?.[this.csrfCookieName];
    if (typeof value !== 'string') return null;
    const token = value.trim();
    return token.length > 0 ? token : null;
  }

  assertCsrfToken(req: Request): string {
    const cookieToken = this.readCsrfTokenFromRequest(req);
    const headerValue = req.header(this.csrfHeaderName);
    const headerToken = typeof headerValue === 'string' ? headerValue.trim() : '';

    if (!cookieToken || !headerToken) {
      throw new ForbiddenException('CSRF token faltante.');
    }

    if (!this.safeEqual(cookieToken, headerToken)) {
      throw new ForbiddenException('CSRF token invalido.');
    }

    return headerToken;
  }

  setAuthCookies(
    response: Response,
    refreshToken: string,
    refreshExpiresAt: Date,
    csrfToken: string,
  ): void {
    response.cookie(this.refreshCookieName, refreshToken, {
      httpOnly: true,
      secure: this.refreshCookieSecure,
      sameSite: this.refreshCookieSameSite,
      path: this.refreshCookiePath,
      ...(this.refreshCookieDomain ? { domain: this.refreshCookieDomain } : {}),
      expires: refreshExpiresAt,
    });

    response.cookie(this.csrfCookieName, csrfToken, {
      httpOnly: false,
      secure: this.refreshCookieSecure,
      sameSite: this.refreshCookieSameSite,
      path: this.csrfCookiePath,
      ...(this.refreshCookieDomain ? { domain: this.refreshCookieDomain } : {}),
      expires: refreshExpiresAt,
    });
  }

  clearAuthCookies(response: Response): void {
    response.clearCookie(this.refreshCookieName, {
      httpOnly: true,
      secure: this.refreshCookieSecure,
      sameSite: this.refreshCookieSameSite,
      path: this.refreshCookiePath,
      ...(this.refreshCookieDomain ? { domain: this.refreshCookieDomain } : {}),
    });

    response.clearCookie(this.csrfCookieName, {
      httpOnly: false,
      secure: this.refreshCookieSecure,
      sameSite: this.refreshCookieSameSite,
      path: this.csrfCookiePath,
      ...(this.refreshCookieDomain ? { domain: this.refreshCookieDomain } : {}),
    });
  }

  private resolveCookieSecureValue(isProduction: boolean): boolean {
    const configured = this.configService.get<boolean | undefined>(
      'AUTH_REFRESH_COOKIE_SECURE',
      undefined,
    );

    if (configured === undefined) {
      return isProduction;
    }

    return configured;
  }

  private safeEqual(a: string, b: string): boolean {
    const left = Buffer.from(a, 'utf8');
    const right = Buffer.from(b, 'utf8');

    if (left.length !== right.length) return false;
    return timingSafeEqual(left, right);
  }
}
