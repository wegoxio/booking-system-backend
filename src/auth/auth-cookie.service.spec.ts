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
});
