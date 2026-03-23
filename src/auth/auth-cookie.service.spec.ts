import { ConfigService } from '@nestjs/config';
import { AuthCookieService } from './auth-cookie.service';

describe('AuthCookieService', () => {
  it('uses SameSite=none by default in production', () => {
    const service = new AuthCookieService(
      new ConfigService({
        NODE_ENV: 'production',
      }),
    );

    expect((service as any).refreshCookieSameSite).toBe('none');
    expect((service as any).refreshCookieSecure).toBe(true);
  });

  it('keeps SameSite=lax by default in development', () => {
    const service = new AuthCookieService(
      new ConfigService({
        NODE_ENV: 'development',
      }),
    );

    expect((service as any).refreshCookieSameSite).toBe('lax');
    expect((service as any).refreshCookieSecure).toBe(false);
  });

  it('rejects SameSite=none when secure cookies are disabled', () => {
    expect(
      () =>
        new AuthCookieService(
          new ConfigService({
            NODE_ENV: 'production',
            AUTH_REFRESH_COOKIE_SAME_SITE: 'none',
            AUTH_REFRESH_COOKIE_SECURE: false,
          }),
        ),
    ).toThrow('AUTH_REFRESH_COOKIE_SAME_SITE=none requiere AUTH_REFRESH_COOKIE_SECURE=true');
  });

  it('accepts CSRF header when duplicate CSRF cookies exist and one matches', () => {
    const service = new AuthCookieService(
      new ConfigService({
        NODE_ENV: 'development',
        AUTH_CSRF_COOKIE_NAME: 'wegox_csrf',
      }),
    );

    const req = {
      cookies: {
        wegox_csrf: 'legacy-token',
      },
      headers: {
        cookie: 'wegox_csrf=legacy-token; wegox_csrf=current-token',
      },
      header: (name: string) =>
        name.toLowerCase() === 'x-csrf-token' ? 'current-token' : undefined,
    } as any;

    expect(() => service.assertCsrfToken(req)).not.toThrow();
  });
});
