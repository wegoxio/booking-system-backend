import { validateEnv } from './env.validation';

function buildValidEnv(overrides: Record<string, unknown> = {}) {
  return {
    DB_HOST: 'localhost',
    DB_PORT: '5432',
    DB_USER: 'booking',
    DB_PASSWORD: 'booking-password',
    DB_NAME: 'booking',
    JWT_SECRET: 'a-secure-jwt-secret-for-tests',
    APP_PUBLIC_URL: 'http://localhost:3000',
    CORS_ORIGINS: 'http://localhost:3000',
    ...overrides,
  };
}

describe('validateEnv', () => {
  it('rejects Turnstile enabled without a secret key', () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

    try {
      expect(() =>
        validateEnv(
          buildValidEnv({
            TURNSTILE_ENABLED: 'true',
            TURNSTILE_SECRET_KEY: '',
          }),
        ),
      ).toThrow('Variables de entorno invalidas.');
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });

  it('accepts Turnstile enabled with a secret key', () => {
    const env = validateEnv(
      buildValidEnv({
        TURNSTILE_ENABLED: 'true',
        TURNSTILE_SECRET_KEY: 'turnstile-secret',
      }),
    );

    expect(env.TURNSTILE_ENABLED).toBe(true);
    expect(env.TURNSTILE_SECRET_KEY).toBe('turnstile-secret');
  });
});
