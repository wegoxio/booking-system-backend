import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';

function normalizeOrigin(origin: string): string {
  return origin.trim().replace(/\/+$/, '');
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const isProduction = configService.get<string>('NODE_ENV', 'development') === 'production';

  const allowedOrigins = configService
    .get<string[]>('CORS_ORIGINS', ['http://localhost:3000'])
    .map(normalizeOrigin);
  const allowedOriginSet = new Set(allowedOrigins);

  const corsAllowCredentials = configService.get<boolean>('CORS_ALLOW_CREDENTIALS', true);
  const corsAllowedHeaders = configService.get<string[]>(
    'CORS_ALLOWED_HEADERS',
    ['Content-Type', 'Authorization'],
  );
  const corsAllowedMethods = configService.get<string[]>(
    'CORS_ALLOWED_METHODS',
    ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  );
  const corsMaxAgeSeconds = configService.get<number>('CORS_MAX_AGE_SECONDS', 600);

  if (isProduction && allowedOriginSet.size === 0) {
    throw new Error('CORS_ORIGINS no puede estar vacio en produccion.');
  }

  app.getHttpAdapter().getInstance().set('trust proxy', 1);
  app.use(cookieParser());
  app.use(
    helmet({
      contentSecurityPolicy: isProduction ? undefined : false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      hsts: isProduction
        ? {
            maxAge: 31536000,
            includeSubDomains: true,
            preload: true,
          }
        : false,
    }),
  );

  app.setGlobalPrefix('api');
  app.enableCors({
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true);
        return;
      }

      const normalized = normalizeOrigin(origin);
      if (allowedOriginSet.has(normalized)) {
        callback(null, true);
        return;
      }

      callback(new Error(`Origen no permitido por CORS: ${origin}`), false);
    },
    methods: corsAllowedMethods,
    credentials: corsAllowCredentials,
    allowedHeaders: corsAllowedHeaders,
    optionsSuccessStatus: 204,
    maxAge: corsMaxAgeSeconds,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
