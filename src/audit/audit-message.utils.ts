type AuditMessageInput = {
  action: string;
  message?: string | null;
  metadata?: Record<string, any> | null;
};

const MAX_AUDIT_MESSAGE_LENGTH = 240;

const FIELD_LABELS: Record<string, string> = {
  name: 'nombre',
  email: 'correo',
  phone: 'teléfono',
  slug: 'URL pública',
  is_active: 'estado',
  duration_minutes: 'duración',
  buffer_before_minutes: 'margen antes de la cita',
  buffer_after_minutes: 'margen después de la cita',
  capacity: 'capacidad',
  min_capacity: 'capacidad mínima',
  max_capacity: 'capacidad máxima',
  min_party_size: 'mínimo de personas',
  max_party_size: 'máximo de personas',
  slot_capacity: 'cupos por horario',
  currency: 'moneda',
  price: 'precio',
  pricing_model: 'tipo de precio',
  sort_order: 'orden',
  requires_confirmation: 'confirmación requerida',
  min_notice_minutes: 'anticipación mínima',
  booking_window_days: 'ventana de reserva',
  theme: 'colores',
  themeMode: 'modo de apariencia',
  themeOverrides: 'personalización visual',
  branding: 'marca',
  logoUrl: 'logo',
  faviconUrl: 'favicon',
  avatar_url: 'foto',
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'pendiente',
  CONFIRMED: 'confirmada',
  IN_PROGRESS: 'en progreso',
  COMPLETED: 'completada',
  CANCELLED: 'cancelada',
  NO_SHOW: 'no asistió',
};

const KNOWN_AUDIT_ACTIONS = new Set([
  'AUTH_LOGIN_SUCCESS',
  'AUTH_LOGIN_FAILED',
  'AUTH_LOGIN_BLOCKED',
  'AUTH_ACCOUNT_LOCKED',
  'AUTH_REFRESH_SUCCESS',
  'AUTH_REFRESH_DUPLICATE_REJECTED',
  'AUTH_REFRESH_FAILED',
  'AUTH_REFRESH_REUSE_DETECTED',
  'AUTH_LOGOUT',
  'AUTH_LOGOUT_ALL',
  'AUTH_EMAIL_VERIFIED',
  'AUTH_ACCESS_SETUP_LINK_SENT',
  'AUTH_PASSWORD_RESET_REQUESTED',
  'AUTH_PASSWORD_RESET_COMPLETED',
  'AUTH_TENANT_ADMIN_ONBOARDING_COMPLETED',
  'AUTH_TENANT_DASHBOARD_TOUR_COMPLETED',
  'TENANT_CREATED',
  'TENANT_UPDATED',
  'TENANT_ENABLED',
  'TENANT_DISABLED',
  'TENANT_DELETED',
  'TENANT_ADMIN_CREATED',
  'TENANT_ADMIN_INVITATION_SENT',
  'TENANT_ADMIN_INVITATION_FAILED',
  'TENANT_ADMIN_EMAIL_CHANGED',
  'TENANT_ADMIN_UPDATED',
  'TENANT_ADMIN_ENABLED',
  'TENANT_ADMIN_DISABLED',
  'TENANT_ADMIN_DELETED',
  'EMPLOYEE_CREATED',
  'EMPLOYEE_UPDATED',
  'SERVICE_CREATED',
  'SERVICE_UPDATED',
  'SERVICE_ENABLED',
  'SERVICE_DISABLED',
  'EMPLOYEE_SCHEDULE_CREATED',
  'EMPLOYEE_SCHEDULE_UPDATED',
  'EMPLOYEE_TIME_OFF_CREATED',
  'EMPLOYEE_TIME_OFF_REMOVED',
  'BOOKING_CREATED',
  'BOOKING_STATUS_UPDATED',
  'TENANT_SETTINGS_UPDATED',
  'TENANT_SETTINGS_ASSET_UPLOADED',
  'PLATFORM_SETTINGS_UPDATED',
  'PLATFORM_SETTINGS_ASSET_UPLOADED',
]);

function trimToMaxLength(value: string): string {
  if (value.length <= MAX_AUDIT_MESSAGE_LENGTH) return value;
  return `${value.slice(0, MAX_AUDIT_MESSAGE_LENGTH - 3)}...`;
}

function listUpdatedFields(metadata?: Record<string, any> | null): string {
  const fields = Array.isArray(metadata?.updated_fields)
    ? metadata.updated_fields.filter(
        (field: unknown) => typeof field === 'string',
      )
    : [];

  if (fields.length === 0) return 'detalles actualizados';
  return fields
    .slice(0, 5)
    .map((field) => FIELD_LABELS[field] ?? field.replaceAll('_', ' '))
    .join(', ');
}

function buildByAction(
  action: string,
  metadata?: Record<string, any> | null,
): string {
  switch (action) {
    case 'AUTH_LOGIN_SUCCESS':
      return 'Inicio de sesión exitoso.';
    case 'AUTH_LOGIN_FAILED':
      return 'Intento de inicio de sesión fallido.';
    case 'AUTH_LOGIN_BLOCKED':
      return 'Inicio de sesión bloqueado.';
    case 'AUTH_ACCOUNT_LOCKED':
      return 'Cuenta bloqueada temporalmente por intentos fallidos.';
    case 'AUTH_REFRESH_SUCCESS':
      return 'Sesión renovada correctamente.';
    case 'AUTH_REFRESH_DUPLICATE_REJECTED':
      return 'Sesión renovada correctamente.';
    case 'AUTH_REFRESH_FAILED':
      return 'No se pudo renovar la sesión.';
    case 'AUTH_REFRESH_REUSE_DETECTED':
      return 'Se detectó actividad sospechosa en la sesión y se cerraron las sesiones activas.';
    case 'AUTH_LOGOUT':
      return 'Sesión cerrada.';
    case 'AUTH_LOGOUT_ALL':
      return 'Todas las sesiones fueron cerradas.';
    case 'AUTH_EMAIL_VERIFIED':
      return 'Correo electrónico verificado correctamente.';
    case 'AUTH_ACCESS_SETUP_LINK_SENT':
      return 'Se envió un enlace para activar el acceso.';
    case 'AUTH_PASSWORD_RESET_REQUESTED':
      return 'Se solicitó un restablecimiento de contraseña.';
    case 'AUTH_PASSWORD_RESET_COMPLETED':
      return 'La contraseña fue restablecida.';
    case 'AUTH_TENANT_ADMIN_ONBOARDING_COMPLETED':
      return 'Administrador de negocio activado correctamente.';
    case 'AUTH_TENANT_DASHBOARD_TOUR_COMPLETED':
      return 'Tour guiado completado.';

    case 'TENANT_CREATED':
      return `Negocio "${metadata?.name ?? 'N/A'}" creado.`;
    case 'TENANT_UPDATED':
      return `Negocio actualizado (${listUpdatedFields(metadata)}).`;
    case 'TENANT_ENABLED':
      return `Negocio "${metadata?.name ?? 'N/A'}" habilitado.`;
    case 'TENANT_DISABLED':
      return `Negocio "${metadata?.name ?? 'N/A'}" deshabilitado.`;
    case 'TENANT_DELETED':
      return `Negocio "${metadata?.name ?? 'N/A'}" eliminado.`;

    case 'TENANT_ADMIN_CREATED':
      return `Administrador del negocio "${metadata?.name ?? 'N/A'}" creado.`;
    case 'TENANT_ADMIN_INVITATION_SENT':
      return `Invitación enviada a "${metadata?.email ?? 'N/A'}".`;
    case 'TENANT_ADMIN_INVITATION_FAILED':
      return `No se pudo enviar la invitación a "${metadata?.email ?? 'N/A'}".`;
    case 'TENANT_ADMIN_EMAIL_CHANGED':
      return 'Correo del administrador actualizado. Se requiere activar el nuevo acceso.';
    case 'TENANT_ADMIN_UPDATED':
      return `Administrador del negocio actualizado (${listUpdatedFields(metadata)}).`;
    case 'TENANT_ADMIN_ENABLED':
      return `Administrador del negocio "${metadata?.name ?? 'N/A'}" habilitado.`;
    case 'TENANT_ADMIN_DISABLED':
      return `Administrador del negocio "${metadata?.name ?? 'N/A'}" deshabilitado.`;
    case 'TENANT_ADMIN_DELETED':
      return `Administrador del negocio "${metadata?.name ?? 'N/A'}" eliminado.`;

    case 'EMPLOYEE_CREATED':
      return `Profesional "${metadata?.name ?? 'N/A'}" creado.`;
    case 'EMPLOYEE_UPDATED':
      return `Profesional actualizado (${listUpdatedFields(metadata)}).`;

    case 'SERVICE_CREATED':
      return `Servicio "${metadata?.name ?? 'N/A'}" creado.`;
    case 'SERVICE_UPDATED':
      return `Servicio actualizado (${listUpdatedFields(metadata)}).`;
    case 'SERVICE_ENABLED':
      return `Servicio "${metadata?.name ?? 'N/A'}" habilitado.`;
    case 'SERVICE_DISABLED':
      return `Servicio "${metadata?.name ?? 'N/A'}" deshabilitado.`;

    case 'EMPLOYEE_SCHEDULE_CREATED':
      return 'Horario de profesional creado.';
    case 'EMPLOYEE_SCHEDULE_UPDATED':
      return `Horario de profesional actualizado (${metadata?.working_hours_count ?? 0} bloques).`;
    case 'EMPLOYEE_TIME_OFF_CREATED':
      return 'Bloqueo de agenda creado.';
    case 'EMPLOYEE_TIME_OFF_REMOVED':
      return 'Bloqueo de agenda eliminado.';

    case 'BOOKING_CREATED':
      return `Cita creada (${Array.isArray(metadata?.service_ids) ? metadata.service_ids.length : 0} servicio(s)).`;
    case 'BOOKING_STATUS_UPDATED':
      return metadata?.cancellation_reason
        ? `Estado de cita cambiado a ${STATUS_LABELS[metadata?.status] ?? metadata?.status ?? 'N/A'} (${metadata.cancellation_reason}).`
        : `Estado de cita cambiado a ${STATUS_LABELS[metadata?.status] ?? metadata?.status ?? 'N/A'}.`;

    case 'TENANT_SETTINGS_UPDATED':
      return `Configuración del negocio actualizada (${listUpdatedFields(metadata)}).`;
    case 'TENANT_SETTINGS_ASSET_UPLOADED':
      return `Se actualizó el ${metadata?.asset_type === 'favicon' ? 'favicon' : metadata?.asset_type === 'logo' ? 'logo' : 'recurso visual'} del negocio.`;

    case 'PLATFORM_SETTINGS_UPDATED':
      return `Configuración de plataforma actualizada (${listUpdatedFields(metadata)}).`;
    case 'PLATFORM_SETTINGS_ASSET_UPLOADED':
      return `Se actualizó el ${metadata?.asset_type === 'favicon' ? 'favicon' : metadata?.asset_type === 'logo' ? 'logo' : 'recurso visual'} de la plataforma.`;

    default: {
      const fallback = action
        .toLowerCase()
        .split('_')
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
      return `${fallback}.`;
    }
  }
}

export function resolveAuditMessage(input: AuditMessageInput): string {
  if (KNOWN_AUDIT_ACTIONS.has(input.action)) {
    return trimToMaxLength(buildByAction(input.action, input.metadata));
  }

  const explicitMessage = input.message?.trim();
  if (explicitMessage) {
    return trimToMaxLength(
      explicitMessage
        .replaceAll('tenant', 'negocio')
        .replaceAll('Tenant', 'Negocio')
        .replaceAll('_', ' '),
    );
  }

  const built = buildByAction(input.action, input.metadata);
  return trimToMaxLength(built);
}
