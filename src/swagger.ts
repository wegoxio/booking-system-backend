import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export function setupSwagger(app: INestApplication): void {
  const configService = app.get(ConfigService);
  const nodeEnv = configService.get<string>('NODE_ENV', 'development');

  if (nodeEnv !== 'development') {
    return;
  }

  const documentConfig = new DocumentBuilder()
    .setTitle('Wegox Booking API')
    .setDescription(
      [
        'Documentación técnica de la API de Bukky',
        '',
        'Disponible únicamente en entorno de desarrollo.',
        '',
        'Autenticación administrativa:',
        '- Access token por header Authorization: Bearer <token>.',
        '- Refresh token en cookie HttpOnly.',
        '- CSRF por cookie y header X-CSRF-Token en flujos autenticados.',
        '',
        'Reservas públicas:',
        '- Los endpoints públicos de creación y reprogramación requieren Idempotency-Key.',
        '- Turnstile puede ser obligatorio según configuración del entorno.',
      ].join('\n'),
    )
    .setVersion('1.0.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Access token devuelto por /api/auth/login.',
      },
      'access-token',
    )
    .addCookieAuth('wegox_refresh', {
      type: 'apiKey',
      in: 'cookie',
      description: 'Refresh token HttpOnly emitido por el backend.',
    })
    .addApiKey(
      {
        type: 'apiKey',
        in: 'header',
        name: 'X-CSRF-Token',
        description: 'Token CSRF requerido en flujos autenticados con cookie.',
      },
      'csrf-token',
    )
    .addApiKey(
      {
        type: 'apiKey',
        in: 'header',
        name: 'Idempotency-Key',
        description:
          'Clave de idempotencia requerida para crear o reprogramar reservas públicas.',
      },
      'idempotency-key',
    )
    .addTag('Auth', 'Autenticación, MFA, sesiones y recuperación de cuenta.')
    .addTag('Tenants', 'Gestión de negocios y datos públicos del negocio.')
    .addTag('Users', 'Administradores de negocio.')
    .addTag('Services', 'Servicios ofrecidos por un negocio.')
    .addTag('Employees', 'Profesionales, avatares y datos operativos.')
    .addTag('Bookings', 'Citas, disponibilidad, horarios y reprogramación.')
    .addTag('Public bookings', 'Flujo público de reserva por negocio.')
    .addTag(
      'Public booking management',
      'Gestión pública de citas mediante token seguro.',
    )
    .addTag('Tenant settings', 'Branding, theme builder y recursos visuales.')
    .addTag('Public settings', 'Configuración pública visible por slug.')
    .addTag('Dashboard', 'Métricas de panel por rol.')
    .addTag('Reports', 'Reportes y exportación.')
    .addTag('Audit logs', 'Bitácora operativa.')
    .build();

  const document = SwaggerModule.createDocument(app, documentConfig, {
    deepScanRoutes: true,
  });

  SwaggerModule.setup('api/docs', app, document, {
    jsonDocumentUrl: 'api/docs-json',
    yamlDocumentUrl: 'api/docs-yaml',
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      filter: true,
      tagsSorter: 'alpha',
      operationsSorter: 'method',
    },
    customSiteTitle: 'Bukky API Docs',
  });
}
