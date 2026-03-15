type AuditMessageInput = {
  action: string;
  message?: string | null;
  metadata?: Record<string, any> | null;
};

const MAX_AUDIT_MESSAGE_LENGTH = 240;

function trimToMaxLength(value: string): string {
  if (value.length <= MAX_AUDIT_MESSAGE_LENGTH) return value;
  return `${value.slice(0, MAX_AUDIT_MESSAGE_LENGTH - 3)}...`;
}

function listUpdatedFields(metadata?: Record<string, any> | null): string {
  const fields = Array.isArray(metadata?.updated_fields)
    ? metadata.updated_fields.filter((field: unknown) => typeof field === 'string')
    : [];

  if (fields.length === 0) return 'campos no especificados';
  return fields.slice(0, 5).join(', ');
}

function buildByAction(action: string, metadata?: Record<string, any> | null): string {
  switch (action) {
    case 'AUTH_LOGIN_SUCCESS':
      return 'Inicio de sesion exitoso.';
    case 'AUTH_LOGIN_FAILED':
      return 'Intento de inicio de sesion fallido.';
    case 'AUTH_LOGIN_BLOCKED':
      return 'Inicio de sesion bloqueado.';
    case 'AUTH_ACCOUNT_LOCKED':
      return 'Cuenta bloqueada temporalmente por intentos fallidos.';
    case 'AUTH_REFRESH_SUCCESS':
      return 'Sesion renovada correctamente.';
    case 'AUTH_REFRESH_FAILED':
      return 'No se pudo renovar la sesion.';
    case 'AUTH_REFRESH_REUSE_DETECTED':
      return 'Se detecto reutilizacion del refresh token; sesiones revocadas.';
    case 'AUTH_LOGOUT':
      return 'Sesion cerrada.';
    case 'AUTH_LOGOUT_ALL':
      return 'Todas las sesiones fueron cerradas.';

    case 'TENANT_CREATED':
      return `Tenant "${metadata?.name ?? 'N/A'}" creado.`;
    case 'TENANT_UPDATED':
      return `Tenant actualizado (${listUpdatedFields(metadata)}).`;
    case 'TENANT_DELETED':
      return `Tenant "${metadata?.name ?? 'N/A'}" eliminado.`;

    case 'TENANT_ADMIN_CREATED':
      return `Tenant admin "${metadata?.name ?? 'N/A'}" creado.`;
    case 'TENANT_ADMIN_UPDATED':
      return `Tenant admin actualizado (${listUpdatedFields(metadata)}).`;
    case 'TENANT_ADMIN_DELETED':
      return `Tenant admin "${metadata?.name ?? 'N/A'}" eliminado.`;

    case 'EMPLOYEE_CREATED':
      return `Employee "${metadata?.name ?? 'N/A'}" creado.`;
    case 'EMPLOYEE_UPDATED':
      return `Employee actualizado (${listUpdatedFields(metadata)}).`;

    case 'SERVICE_CREATED':
      return `Servicio "${metadata?.name ?? 'N/A'}" creado.`;
    case 'SERVICE_UPDATED':
      return `Servicio actualizado (${listUpdatedFields(metadata)}).`;
    case 'SERVICE_ENABLED':
      return `Servicio "${metadata?.name ?? 'N/A'}" habilitado.`;
    case 'SERVICE_DISABLED':
      return `Servicio "${metadata?.name ?? 'N/A'}" deshabilitado.`;

    case 'EMPLOYEE_SCHEDULE_CREATED':
      return 'Horario de employee creado.';
    case 'EMPLOYEE_SCHEDULE_UPDATED':
      return `Horario de employee actualizado (${metadata?.working_hours_count ?? 0} bloques).`;
    case 'EMPLOYEE_TIME_OFF_CREATED':
      return 'Bloqueo de agenda creado.';
    case 'EMPLOYEE_TIME_OFF_REMOVED':
      return 'Bloqueo de agenda eliminado.';

    case 'BOOKING_CREATED':
      return `Booking creada (${Array.isArray(metadata?.service_ids) ? metadata.service_ids.length : 0} servicio(s)).`;
    case 'BOOKING_STATUS_UPDATED':
      return `Estado de booking cambiado a ${metadata?.status ?? 'N/A'}.`;

    case 'TENANT_SETTINGS_UPDATED':
      return `Settings del tenant actualizados (${listUpdatedFields(metadata)}).`;
    case 'TENANT_SETTINGS_ASSET_UPLOADED':
      return `Asset de tenant subido (${metadata?.asset_type ?? 'N/A'}).`;

    case 'PLATFORM_SETTINGS_UPDATED':
      return `Settings de plataforma actualizados (${listUpdatedFields(metadata)}).`;
    case 'PLATFORM_SETTINGS_ASSET_UPLOADED':
      return `Asset de plataforma subido (${metadata?.asset_type ?? 'N/A'}).`;

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
  const explicitMessage = input.message?.trim();
  if (explicitMessage) {
    return trimToMaxLength(explicitMessage);
  }

  const built = buildByAction(input.action, input.metadata);
  return trimToMaxLength(built);
}
