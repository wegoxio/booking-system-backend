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
      'wegox_refresh',
    );
    this.refreshCookiePath = this.normalizeCookiePath(
      this.configService.get<string>('AUTH_REFRESH_COOKIE_PATH', '/api/auth'),
    );

    const configuredDomain = this.configService
      .get<string>('AUTH_REFRESH_COOKIE_DOMAIN')
      ?.trim();
    this.refreshCookieDomain = configuredDomain ? configuredDomain : undefined;

    this.refreshCookieSameSite =
      this.configService.get<RefreshCookieSameSite | undefined>(
        'AUTH_REFRESH_COOKIE_SAME_SITE',
        undefined,
      ) ?? (isProduction ? 'none' : 'lax');
    this.refreshCookieSecure = this.resolveCookieSecureValue(isProduction);

    this.csrfCookieName = this.configService.get<string>(
      'AUTH_CSRF_COOKIE_NAME',
      'wegox_csrf',
    );
    this.csrfCookiePath = this.normalizeCookiePath(
      this.configService.get<string>('AUTH_CSRF_COOKIE_PATH', '/'),
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
    return this.readCookieValues(req, this.refreshCookieName)[0] ?? null;
  }

  readCsrfTokenFromRequest(req: Request): string | null {
    return this.readCookieValues(req, this.csrfCookieName)[0] ?? null;
  }

  assertCsrfToken(req: Request): string {
    const cookieTokens = this.readCsrfTokensFromRequest(req);
    const headerValue = req.header(this.csrfHeaderName);
    const headerToken = typeof headerValue === 'string' ? headerValue.trim() : '';

    if (cookieTokens.length === 0 || !headerToken) {
      throw new ForbiddenException('Token CSRF faltante.');
    }

    const hasCookieMatch = cookieTokens.some((cookieToken) =>
      this.safeEqual(cookieToken, headerToken),
    );

    if (!hasCookieMatch) {
      throw new ForbiddenException('Token CSRF invalido.');
    }

    return headerToken;
  }

  setAuthCookies(
    response: Response,
    refreshToken: string,
    refreshExpiresAt: Date,
    csrfToken: string,
  ): void {
    this.clearRefreshCookieAcrossKnownPaths(response);
    this.clearCsrfCookieAcrossKnownPaths(response);

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
    this.clearRefreshCookieAcrossKnownPaths(response);
    this.clearCsrfCookieAcrossKnownPaths(response);
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

  private readCsrfTokensFromRequest(req: Request): string[] {
    return this.readCookieValues(req, this.csrfCookieName);
  }

  private readCookieValues(req: Request, cookieName: string): string[] {
    const values = new Set<string>();
    const rawCookieHeader = req.headers?.cookie;

    if (typeof rawCookieHeader === 'string') {
      const cookiePairs = rawCookieHeader.split(';');

      for (const pair of cookiePairs) {
        const trimmedPair = pair.trim();
        if (!trimmedPair) continue;

        const separatorIndex = trimmedPair.indexOf('=');
        if (separatorIndex <= 0) continue;

        const name = trimmedPair.slice(0, separatorIndex).trim();
        if (name !== cookieName) continue;

        const rawValue = trimmedPair.slice(separatorIndex + 1).trim();
        const decodedValue = this.decodeCookieValue(rawValue).trim();
        if (decodedValue.length > 0) {
          values.add(decodedValue);
        }
      }
    }

    const parsedCookieValue = req.cookies?.[cookieName];
    if (typeof parsedCookieValue === 'string') {
      const normalized = parsedCookieValue.trim();
      if (normalized.length > 0) {
        values.add(normalized);
      }
    }

    return Array.from(values);
  }

  private decodeCookieValue(value: string): string {
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  }

  private clearRefreshCookieAcrossKnownPaths(response: Response): void {
    const paths = this.collectCookiePaths(this.refreshCookiePath, [
      '/api/auth',
      '/',
    ]);

    for (const path of paths) {
      response.clearCookie(this.refreshCookieName, {
        httpOnly: true,
        secure: this.refreshCookieSecure,
        sameSite: this.refreshCookieSameSite,
        path,
        ...(this.refreshCookieDomain ? { domain: this.refreshCookieDomain } : {}),
      });
    }
  }

  private clearCsrfCookieAcrossKnownPaths(response: Response): void {
    const paths = this.collectCookiePaths(this.csrfCookiePath, [
      '/',
      '/api',
      '/api/auth',
    ]);

    for (const path of paths) {
      response.clearCookie(this.csrfCookieName, {
        httpOnly: false,
        secure: this.refreshCookieSecure,
        sameSite: this.refreshCookieSameSite,
        path,
        ...(this.refreshCookieDomain ? { domain: this.refreshCookieDomain } : {}),
      });
    }
  }

  private collectCookiePaths(primaryPath: string, legacyPaths: string[]): string[] {
    const uniquePaths = new Set<string>();
    uniquePaths.add(primaryPath);

    for (const path of legacyPaths) {
      uniquePaths.add(this.normalizeCookiePath(path));
    }

    return Array.from(uniquePaths);
  }

  private normalizeCookiePath(path: string): string {
    const trimmed = path.trim();
    if (!trimmed) return '/';

    const prefixed = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
    if (prefixed.length > 1 && prefixed.endsWith('/')) {
      return prefixed.slice(0, -1);
    }

    return prefixed;
  }
}

