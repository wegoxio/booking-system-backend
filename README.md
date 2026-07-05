# Wegox Booking Backend

API REST de Wegox Booking, una plataforma SaaS multiempresa para reservas, gestión de citas y operación diaria de negocios de servicios.

## Qué resuelve este backend

- Autenticación con JWT, refresh token en cookie HttpOnly y protección CSRF.
- MFA con app autenticadora para administradores.
- Control de sesiones activas, cierre de otras sesiones y revocación tras cambios sensibles.
- Aislamiento multiempresa por negocio.
- Gestión de negocios, administradores, servicios, profesionales y horarios.
- Motor de disponibilidad para reservas públicas y reservas manuales desde panel.
- Reprogramación segura de citas mediante enlace con token único.
- Validación de capacidad, solapes y estados de citas.
- Branding por negocio y por plataforma.
- Subida de assets a S3 para logos, favicon y recursos visuales.
- Notificaciones por email separadas para cliente y profesional.
- Recordatorios automáticos para citas próximas.
- Auditoría operativa y métricas de dashboard.
- Configuración editable del negocio: nombre, teléfono, dirección, ciudad, estado, país y email público.
- Swagger/OpenAPI disponible solo en desarrollo.
- Monitoreo de errores con Sentry.

## Stack técnico

- NestJS 11
- TypeORM 0.3
- PostgreSQL
- Argon2
- Zod para validación de entorno
- AWS S3 para assets públicos
- Resend para email transaccional
- Cloudflare Turnstile para captcha
- Sentry para monitoreo de errores

## Módulos principales

- `auth`
- `tenant`
- `users`
- `services`
- `employees`
- `bookings`
- `tenant-settings`
- `notifications`
- `reminders`
- `audit`
- `dashboard`

## Documentación Swagger

En entorno de desarrollo, la API expone documentación OpenAPI en:

```text
http://localhost:3001/api/docs
```

También están disponibles:

```text
http://localhost:3001/api/docs-json
http://localhost:3001/api/docs-yaml
```

La documentación no se registra cuando `NODE_ENV` no es `development`, por lo que no queda accesible en producción.

La especificación incluye:

- Endpoints públicos y privados.
- DTOs de body y query mediante el plugin de Nest Swagger.
- Esquema Bearer para access token.
- Cookie de refresh.
- Header CSRF.
- Header `Idempotency-Key` para reservas públicas y reprogramación pública.
- Uploads multipart de logos, favicon y avatares.

## Requisitos

- Node.js 20+
- pnpm
- PostgreSQL

## Puesta en marcha local

1. Instala dependencias:

```bash
pnpm install
```

2. Crea tu archivo de entorno a partir de `.env.example`.

3. Configura como mínimo:

- Base de datos PostgreSQL.
- Cookies y CORS.
- Secretos JWT.
- Secretos de MFA.
- Turnstile si quieres captcha.
- Resend si quieres email.
- S3 si quieres subida de assets.

4. Ejecuta migraciones:

```bash
pnpm run migration:run
```

5. Si necesitas un superadministrador inicial:

```bash
pnpm run seed:superadmin
```

6. Levanta la API en desarrollo:

```bash
pnpm run start:dev
```

La aplicación expone sus endpoints bajo el prefijo global `api`.

## Scripts útiles

```bash
pnpm build
pnpm exec tsc --noEmit
pnpm run test
pnpm run migration:status
pnpm run migration:run
```

## Seguridad implementada

- Access token de vida corta.
- Refresh token en cookie HttpOnly.
- Protección CSRF para flujos autenticados.
- MFA TOTP para administradores.
- Códigos de recuperación de MFA.
- Registro y control de sesiones activas.
- Revocación de sesiones mediante `logout-all`.
- Rate limiting global configurable.
- Bloqueo temporal por intentos fallidos de login.
- Captcha Turnstile opcional para login y reservas públicas.
- Validación de DTOs en endpoints sensibles.
- Idempotency keys para creación de reservas.
- Tokens únicos para gestión pública de citas.

## Sentry

El backend integra Sentry mediante `@sentry/nestjs`:

- Inicialización temprana antes de cargar módulos Nest.
- Filtro global oficial de Sentry para errores no manejados.
- Captura de errores inesperados de API, servicios y jobs.
- `sendDefaultPii=false`.
- Sanitización explícita de headers, cookies, body, query, extras y contextos.
- Filtrado de tokens, cookies, CSRF, contraseñas, emails, teléfonos, notas y captcha.

Variables:

```env
SENTRY_ENABLED=true
SENTRY_DSN=https://...
SENTRY_ENVIRONMENT=production
SENTRY_RELEASE=2026.07.05.1
SENTRY_TRACES_SAMPLE_RATE=0.02
```

Con `SENTRY_ENABLED=false` o sin `SENTRY_DSN`, el SDK no queda activo.

## Reservas y citas

El backend cubre:

- Reserva pública por `tenantSlug`.
- Reserva manual desde dashboard.
- Reprogramación de citas desde enlace seguro.
- Reprogramación operativa desde panel.
- Estados `PENDING`, `CONFIRMED`, `COMPLETED`, `CANCELLED` y `NO_SHOW`.
- Snapshots históricos de servicios dentro de cada cita.
- Cálculo de precio total desde backend.
- Validación de disponibilidad antes de confirmar.
- Liberación de capacidad al cancelar.
- Historial operativo mediante logs de auditoría.

## Emails transaccionales

El flujo actual separa destinatarios:

- Cliente: recibe confirmación, datos de la cita, datos públicos del negocio, teléfono, dirección y enlace de cómo llegar.
- Profesional: recibe el resumen operativo de la cita que debe atender.
- Administrador del negocio: ya no recibe todos los correos de cada cita por defecto para evitar ruido operativo.

La plantilla del cliente evita exponer datos internos y usa únicamente información necesaria para asistir a la cita.

## S3 y assets públicos

Los assets de branding se suben a S3 con claves como:

- `platform/wegox/assets/...`
- `tenants/{tenantId}/assets/...`

El servicio genera la URL pública así:

1. Si `AWS_S3_PUBLIC_BASE_URL` está definido, usa ese valor como base.
2. Si no está definido, usa directamente:

```text
https://{bucket}.s3.{region}.amazonaws.com/{key}
```

Para los correos, la base de assets se resuelve así:

1. `MAIL_ASSET_BASE_URL`, si existe.
2. URL directa de S3 si existen `AWS_S3_BUCKET` y `AWS_REGION`.
3. `AWS_S3_PUBLIC_BASE_URL`, si existe.
4. `APP_PUBLIC_URL` como último fallback.

Si quieres dejar de usar CloudFront, elimina las URLs de CloudFront en `AWS_S3_PUBLIC_BASE_URL` y `MAIL_ASSET_BASE_URL`, o reemplázalas por la URL directa del bucket público.

Ejemplo:

```env
AWS_REGION=us-east-1
AWS_S3_BUCKET=bukky-assets
AWS_S3_PUBLIC_BASE_URL=https://bukky-assets.s3.us-east-1.amazonaws.com
MAIL_ASSET_BASE_URL=https://bukky-assets.s3.us-east-1.amazonaws.com
```

Importante: si existen URLs antiguas de CloudFront guardadas en la base de datos, los correos pueden seguir funcionando con `logoKey`, pero las vistas que lean `logoUrl` podrían necesitar re-subir el logo o ejecutar un backfill para recalcular esas URLs.

## Configuración recomendada del bucket público

Para servir assets directamente desde S3:

1. Mantén las credenciales AWS solo en backend.
2. Desactiva el bloqueo público únicamente para el bucket de assets.
3. Agrega una política de lectura pública para objetos:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadForBrandingAssets",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::BUCKET_NAME/*"
    }
  ]
}
```

4. Configura CORS si los assets se consumen desde navegador:

```json
[
  {
    "AllowedOrigins": ["https://tu-dominio.com", "http://localhost:3000"],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedHeaders": ["*"],
    "MaxAgeSeconds": 300
  }
]
```

No hagas público el bucket de backups, datos privados o archivos que no sean assets de marca.

## Alcance funcional validado

El estado actual del backend cubre:

- Login, refresh, logout y cierre global de sesiones.
- MFA para administradores.
- Onboarding y activación de cuenta para administradores de negocio.
- Solicitud y completado de restablecimiento de contraseña.
- CRUD de negocios y administradores.
- CRUD de servicios y profesionales.
- Upload de avatar para profesionales.
- Horarios, descansos y ausencias por profesional.
- Reserva pública por negocio.
- Reserva manual desde dashboard.
- Reprogramación de citas.
- Cambio de estado de citas.
- Snapshots de servicios dentro de la cita.
- Branding público y privado.
- Configuración editable de datos públicos del negocio.
- Emails de cita para cliente y profesional.
- Recordatorios programados.
- Auditoría y métricas por rol.
- Swagger/OpenAPI en desarrollo.
- Monitoreo de errores con Sentry.

## Limitaciones conocidas

- No hay pagos integrados.
- No hay WhatsApp o SMS nativo.
- No hay sincronización con calendarios externos.
- `requires_confirmation` existe como dato de negocio, pero aún no dispara un flujo diferencial completo.
