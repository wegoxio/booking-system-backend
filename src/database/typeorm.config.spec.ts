import { ConfigService } from '@nestjs/config';

import { makeTypeOrmConfig } from './typeorm.config';

describe('makeTypeOrmConfig', () => {
  it('uses a single postgres connection by default on Vercel production runtimes', () => {
    const config = new ConfigService({
      NODE_ENV: 'production',
      VERCEL: '1',
      DB_HOST: 'db.example.com',
      DB_PORT: '5432',
      DB_USER: 'postgres',
      DB_PASSWORD: 'secret',
      DB_NAME: 'app',
      DB_SSL: 'true',
    });

    const result = makeTypeOrmConfig(config);

    expect(result.extra).toMatchObject({
      max: 1,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 10_000,
      keepAlive: true,
    });
    expect(result.ssl).toEqual({ rejectUnauthorized: false });
  });

  it('honors an explicit DB_POOL_MAX override', () => {
    const config = new ConfigService({
      NODE_ENV: 'production',
      VERCEL: '1',
      DB_HOST: 'db.example.com',
      DB_PORT: '5432',
      DB_USER: 'postgres',
      DB_PASSWORD: 'secret',
      DB_NAME: 'app',
      DB_POOL_MAX: '4',
    });

    const result = makeTypeOrmConfig(config);

    expect(result.extra).toMatchObject({ max: 4 });
  });
});
