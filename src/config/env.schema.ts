import { z } from 'zod';

function parseCsvToArray(value: unknown): string[] | undefined {
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }

  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  return trimmed
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseOptionalBoolean(value: unknown): boolean | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'boolean') return value;

  const normalized = String(value).trim().toLowerCase();
  if (!normalized) return undefined;
  if (['true', '1', 'yes'].includes(normalized)) return true;
  if (['false', '0', 'no'].includes(normalized)) return false;

  return value as boolean;
}

function parseOptionalString(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  const normalized = String(value).trim();
  if (!normalized) return undefined;
  return normalized;
}

export const envSchema = z.object({
  // App
  NODE_ENV: z.string().default('development'),
  PORT: z.coerce.number().default(3000),
  CORS_ORIGINS: z
    .preprocess(
      parseCsvToArray,
      z.array(z.string().url()).min(1, 'CORS_ORIGINS requiere al menos 1 origen valido'),
    )
    .default(['http://localhost:3000']),
  CORS_ALLOW_CREDENTIALS: z.coerce.boolean().default(true),
  CORS_ALLOWED_HEADERS: z
    .preprocess(
      parseCsvToArray,
      z.array(z.string().min(1)).min(1, 'CORS_ALLOWED_HEADERS requiere al menos 1 header'),
    )
    .default(['Content-Type', 'Authorization', 'X-CSRF-Token']),
  CORS_ALLOWED_METHODS: z
    .preprocess(
      parseCsvToArray,
      z.array(z.string().min(1)).min(1, 'CORS_ALLOWED_METHODS requiere al menos 1 metodo'),
    )
    .default(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']),
  CORS_MAX_AGE_SECONDS: z.coerce.number().default(600),

  // Database
  DB_HOST: z.string(),
  DB_PORT: z.coerce.number(),
  DB_USER: z.string(),
  DB_PASSWORD: z.string(),
  DB_NAME: z.string(),
  DB_SSL: z.coerce.boolean().default(false),
  DB_LOGGING: z.coerce.boolean().default(false),
  DB_POOL_MAX: z.coerce.number().int().positive().optional(),
  DB_POOL_IDLE_TIMEOUT_MS: z.coerce.number().int().positive().default(10000),
  DB_POOL_CONNECTION_TIMEOUT_MS: z.coerce.number().int().positive().default(10000),
  DB_POOL_KEEP_ALIVE: z.coerce.boolean().default(true),

  // Auth (JWT)
  JWT_SECRET: z.string().min(10),
  JWT_EXPIRES_IN: z.string().default('3600s'),
  JWT_ACCESS_EXPIRES_IN: z.string().optional(),
  JWT_REFRESH_SECRET: z.string().min(10).optional(),
  JWT_REFRESH_EXPIRES_IN: z.string().default('30d'),
  AUTH_REFRESH_COOKIE_NAME: z.string().min(1).default('wegox_refresh'),
  AUTH_REFRESH_COOKIE_PATH: z.string().min(1).default('/api/auth'),
  AUTH_REFRESH_COOKIE_DOMAIN: z.preprocess(
    parseOptionalString,
    z.string().min(1).optional(),
  ),
  AUTH_REFRESH_COOKIE_SAME_SITE: z
    .preprocess(parseOptionalString, z.enum(['lax', 'strict', 'none']).optional()),
  AUTH_REFRESH_COOKIE_SECURE: z
    .preprocess(parseOptionalBoolean, z.boolean().optional()),
  AUTH_CSRF_COOKIE_NAME: z.string().min(1).default('wegox_csrf'),
  AUTH_CSRF_COOKIE_PATH: z.string().min(1).default('/'),
  AUTH_CSRF_HEADER_NAME: z.string().min(1).default('x-csrf-token'),
  TURNSTILE_ENABLED: z.coerce.boolean().default(false),
  TURNSTILE_SECRET_KEY: z.string().optional(),
  TURNSTILE_VERIFY_URL: z
    .string()
    .url()
    .default('https://challenges.cloudflare.com/turnstile/v0/siteverify'),
  TURNSTILE_EXPECTED_HOSTNAME: z.string().optional(),
  TURNSTILE_TIMEOUT_MS: z.coerce.number().default(5000),
  TURNSTILE_LOGIN_ACTION: z.string().min(1).default('login'),
  TURNSTILE_BOOKING_ACTION: z.string().min(1).default('booking_create'),

  // Auth security (login/session)
  AUTH_MAX_FAILED_ATTEMPTS: z.coerce.number().default(5),
  AUTH_LOCK_MINUTES: z.coerce.number().default(15),
  AUTH_FAILED_RESET_MINUTES: z.coerce.number().default(30),
  AUTH_TENANT_ADMIN_INVITE_EXPIRES_HOURS: z.coerce.number().default(72),
  AUTH_PASSWORD_RESET_EXPIRES_MINUTES: z.coerce.number().default(60),

  // Rate limit (Throttler)
  RATE_LIMIT_TTL_MS: z.coerce.number().default(60000),
  RATE_LIMIT_LIMIT: z.coerce.number().default(120),

  // Argon2
  ARGON2_MEMORY_COST: z.coerce.number().default(65536),
  ARGON2_TIME_COST: z.coerce.number().default(3),
  ARGON2_PARALLELISM: z.coerce.number().default(1),

  // AWS S3 (tenant branding assets)
  AWS_REGION: z.string().optional(),
  AWS_S3_BUCKET: z.string().optional(),
  AWS_S3_PUBLIC_BASE_URL: z.string().optional(),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  AWS_SESSION_TOKEN: z.string().optional(),
  AWS_S3_FORCE_PATH_STYLE: z.coerce.boolean().default(false),

  // Email notifications
  APP_PUBLIC_URL: z.string().url(),
  MAIL_ENABLED: z.coerce.boolean().default(false),
  MAIL_FROM_EMAIL: z.string().email().optional(),
  MAIL_FROM_NAME: z.string().min(1).default('Wegox Booking'),
  MAIL_REPLY_TO_EMAIL: z.string().email().optional(),
  MAIL_ASSET_BASE_URL: z.string().url().optional(),
  MAIL_RESEND_MIN_INTERVAL_MS: z.coerce.number().default(650),
  RESEND_API_KEY: z.string().optional(),

  // Booking reminders
  REMINDERS_ENABLED: z.coerce.boolean().default(false),
  REMINDERS_TIMEZONE: z.string().min(1).default('America/Caracas'),
  REMINDERS_DISPATCH_HOUR: z.coerce.number().min(0).max(23).default(17),
  REMINDERS_DISPATCH_MINUTE: z.coerce.number().min(0).max(59).default(0),
  REMINDERS_BACKFILL_CRON: z.string().min(1).default('0 0,30 * * * *'),
  REMINDERS_PROCESSOR_CRON: z.string().min(1).default('15 0,30 * * * *'),
  REMINDERS_RECOVERY_CRON: z.string().min(1).default('45 0,30 * * * *'),
  REMINDERS_BATCH_SIZE: z.coerce.number().min(1).max(500).default(25),
  REMINDERS_MAX_ATTEMPTS: z.coerce.number().min(1).max(10).default(3),
  REMINDERS_RETRY_DELAY_MINUTES: z.coerce.number().min(1).max(1440).default(15),
  REMINDERS_PROCESSING_STALE_MINUTES: z.coerce.number().min(1).max(1440).default(10),
}).superRefine((value, ctx) => {
  if (!value.MAIL_ENABLED) {
    return;
  }

  if (!value.MAIL_FROM_EMAIL) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['MAIL_FROM_EMAIL'],
      message: 'MAIL_FROM_EMAIL es requerido cuando MAIL_ENABLED=true',
    });
  }

  if (!value.RESEND_API_KEY) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['RESEND_API_KEY'],
      message: 'RESEND_API_KEY es requerido cuando MAIL_ENABLED=true',
    });
  }
});

export type EnvVars = z.infer<typeof envSchema>;
