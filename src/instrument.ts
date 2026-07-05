import * as Sentry from '@sentry/nestjs';

const SENSITIVE_KEYS = new Set([
  'authorization',
  'cookie',
  'set-cookie',
  'x-csrf-token',
  'csrf',
  'csrf_token',
  'password',
  'current_password',
  'new_password',
  'token',
  'access_token',
  'refresh_token',
  'challenge_token',
  'recovery_code',
  'captcha_token',
  'email',
  'customer_email',
  'phone',
  'customer_phone',
  'notes',
]);

function parseBoolean(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined || value === null || value.trim() === '') {
    return defaultValue;
  }

  return ['true', '1', 'yes'].includes(value.trim().toLowerCase());
}

function parseSampleRate(value: string | undefined, defaultValue: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return defaultValue;
  return Math.max(0, Math.min(parsed, 1));
}

function sanitizeValue(value: unknown, keyHint?: string): unknown {
  if (keyHint && SENSITIVE_KEYS.has(keyHint.toLowerCase())) {
    return '[Filtered]';
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeValue(item));
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, item]) => [
      key,
      sanitizeValue(item, key),
    ]),
  );
}

const enabled = parseBoolean(process.env.SENTRY_ENABLED, false);
const dsn = process.env.SENTRY_DSN?.trim();

if (enabled && dsn) {
  Sentry.init({
    dsn,
    environment:
      process.env.SENTRY_ENVIRONMENT?.trim() ||
      process.env.NODE_ENV ||
      'development',
    release: process.env.SENTRY_RELEASE?.trim() || undefined,
    tracesSampleRate: parseSampleRate(
      process.env.SENTRY_TRACES_SAMPLE_RATE,
      process.env.NODE_ENV === 'production' ? 0.02 : 0.2,
    ),
    sendDefaultPii: false,
    beforeSend(event) {
      event.user = event.user?.id ? { id: event.user.id } : undefined;

      if (event.request) {
        event.request.headers = sanitizeValue(
          event.request.headers,
        ) as typeof event.request.headers;
        event.request.cookies = undefined;
        event.request.data = sanitizeValue(
          event.request.data,
        ) as typeof event.request.data;
        event.request.query_string = sanitizeValue(
          event.request.query_string,
        ) as typeof event.request.query_string;
      }

      event.extra = sanitizeValue(event.extra) as typeof event.extra;
      event.contexts = sanitizeValue(event.contexts) as typeof event.contexts;

      return event;
    },
  });
}
