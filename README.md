# Wegox Booking Backend

API REST de Wegox Booking, una plataforma SaaS de reservas multi-tenant para negocios de servicios.

## Que resuelve este backend

- autenticacion con JWT, refresh token en cookie HttpOnly y proteccion CSRF
- multi-tenancy con aislamiento por `tenant`
- gestion de tenants y tenant admins
- CRUD de servicios y empleados
- motor de disponibilidad por empleado
- reservas publicas y reservas manuales desde panel
- branding por tenant y plataforma
- notificaciones por email
- recordatorios automaticos para citas del dia siguiente
- auditoria operativa y metricas de dashboard

## Stack tecnico

- NestJS 11
- TypeORM 0.3
- PostgreSQL
- Argon2
- Zod para validacion de entorno
- AWS S3 para assets
- Resend para email
- Cloudflare Turnstile para captcha

## Modulos principales

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

3. Configura al menos:

- base de datos PostgreSQL
- cookies y CORS
- secretos JWT
- Turnstile si quieres captcha
- Resend si quieres email
- S3 si quieres subida de assets

4. Ejecuta migraciones:

```bash
pnpm run migration:run
```

5. Si necesitas un super admin inicial:

```bash
pnpm run seed:superadmin
```

6. Levanta la API en desarrollo:

```bash
pnpm run start:dev
```

La aplicacion expone sus endpoints bajo el prefijo global `api`.

## Scripts utiles

```bash
pnpm build
pnpm exec tsc --noEmit
pnpm run test
pnpm run migration:status
pnpm run migration:run
```

## Alcance funcional validado

El estado actual del backend cubre:

- login, refresh, logout y logout-all
- onboarding y activacion de cuenta para tenant admins
- solicitud y completado de password reset
- CRUD de tenants y tenant admins
- CRUD de servicios y empleados
- upload de avatar para empleados
- horarios, breaks y time-off por empleado
- reserva publica por `tenantSlug`
- reserva manual desde dashboard
- cambio de estado de bookings
- snapshots de servicios dentro del booking
- branding publico y privado
- emails de booking y recordatorios programados
- auditoria y metricas por rol

## Compatibilidad de release

Para la primera salida publica del MVP, este backend esta pensado para emparejarse con el frontend `v1.0.0-beta.1`.

## Limitaciones conocidas

- no hay pagos integrados
- no hay WhatsApp o SMS nativo
- no hay calendar sync
- no hay Swagger/OpenAPI publicado todavia
- el campo `requires_confirmation` aun no dispara un flujo diferencial completo
- el campo `capacity` existe, pero el motor actual sigue centrado en disponibilidad por empleado
