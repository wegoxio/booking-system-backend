import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';

function envBool(v: unknown, defaultValue = false): boolean {
  if (v === undefined || v === null) return defaultValue;
  if (typeof v === 'boolean') return v;
  const s = String(v).trim().toLowerCase();
  return ['true', '1', 'yes'].includes(s);
}

function envNumber(v: unknown, defaultValue: number): number {
  if (v === undefined || v === null || String(v).trim() === '') return defaultValue;

  const parsed = Number(v);
  if (Number.isNaN(parsed)) {
    throw new Error(`Invalid numeric database config value: ${v}`);
  }

  return parsed;
}

function resolvePoolMax(config: ConfigService, nodeEnv: string): number {
  const configuredMax = config.get('DB_POOL_MAX');
  if (configuredMax !== undefined) {
    return envNumber(configuredMax, 1);
  }

  const isServerlessRuntime = envBool(config.get('VERCEL'), false) || !!config.get('AWS_LAMBDA_FUNCTION_NAME');
  return nodeEnv === 'production' && isServerlessRuntime ? 1 : 10;
}

export function makeTypeOrmConfig(config: ConfigService): TypeOrmModuleOptions {
  const nodeEnv = config.get<string>('NODE_ENV', 'development');
  const sslFromEnv = envBool(config.get('DB_SSL'), false);

  // En local: siempre NO SSL, aunque env esté raro
  const ssl =
    nodeEnv === 'development' ? false : (sslFromEnv ? { rejectUnauthorized: false } : false);

  const poolMax = resolvePoolMax(config, nodeEnv);

  return {
    type: 'postgres',
    host: config.get<string>('DB_HOST', 'localhost'),
    port: config.get<number>('DB_PORT', 5432),
    username: config.get<string>('DB_USER'),
    password: config.get<string>('DB_PASSWORD'),
    database: config.get<string>('DB_NAME'),

    ssl,
    logging: envBool(config.get('DB_LOGGING'), false),
    extra: {
      max: poolMax,
      idleTimeoutMillis: envNumber(config.get('DB_POOL_IDLE_TIMEOUT_MS'), 10_000),
      connectionTimeoutMillis: envNumber(config.get('DB_POOL_CONNECTION_TIMEOUT_MS'), 10_000),
      keepAlive: envBool(config.get('DB_POOL_KEEP_ALIVE'), true),
    },

    synchronize: false,
    autoLoadEntities: true,
  };
}
