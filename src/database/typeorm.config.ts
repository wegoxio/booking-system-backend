import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';

function envBool(v: unknown, defaultValue = false): boolean {
  if (v === undefined || v === null) return defaultValue;
  if (typeof v === 'boolean') return v;
  const s = String(v).trim().toLowerCase();
  return ['true', '1', 'yes'].includes(s);
}

export function makeTypeOrmConfig(config: ConfigService): TypeOrmModuleOptions {
  const nodeEnv = config.get<string>('NODE_ENV', 'development');
  const sslFromEnv = envBool(config.get('DB_SSL'), false);

  // En local: siempre NO SSL, aunque env esté raro
  const ssl =
    nodeEnv === 'development' ? false : (sslFromEnv ? { rejectUnauthorized: false } : false);

  return {
    type: 'postgres',
    host: config.get<string>('DB_HOST', 'localhost'),
    port: config.get<number>('DB_PORT', 5432),
    username: config.get<string>('DB_USER'),
    password: config.get<string>('DB_PASSWORD'),
    database: config.get<string>('DB_NAME'),

    ssl,
    logging: envBool(config.get('DB_LOGGING'), false),

    synchronize: false,
    autoLoadEntities: true,
  };
}