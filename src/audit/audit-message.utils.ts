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
      return 'Inicio de sesión exitoso.';
    case 'AUTH_LOGIN_FAILED':
      return 'Intento de inicio de sesión fallido.';
    case 'AUTH_LOGIN_BLOCKED':
      return 'Inicio de sesión bloqueado.';
    case 'AUTH_ACCOUNT_LOCKED':
      return 'Cuenta bloqueada temporalmente por intentos fallidos.';
    case 'AUTH_REFRESH_SUCCESS':
      return 'Sesión renovada correctamente.';
    case 'AUTH_REFRESH_FAILED':
      return 'No se pudo renovar la sesión.';
    case 'AUTH_REFRESH_REUSE_DETECTED':
      return 'Se detectó reutilización del token de refresco; sesiones revocadas.';
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
      return 'Onboarding de administrador del negocio completado.';

    case 'TENANT_CREATED':
      return `Negocio "${metadata?.name ?? 'N/A'}" creado.`;
    case 'TENANT_UPDATED':
      return `Negocio actualizado (${listUpdatedFields(metadata)}).`;
    case 'TENANT_DELETED':
      return `Negocio "${metadata?.name ?? 'N/A'}" eliminado.`;

    case 'TENANT_ADMIN_CREATED':
      return `Administrador del negocio "${metadata?.name ?? 'N/A'}" creado.`;
    case 'TENANT_ADMIN_INVITATION_SENT':
      return `Invitación enviada a "${metadata?.email ?? 'N/A'}".`;
    case 'TENANT_ADMIN_UPDATED':
      return `Administrador del negocio actualizado (${listUpdatedFields(metadata)}).`;
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
        ? `Estado de cita cambiado a ${metadata?.status ?? 'N/A'} (${metadata.cancellation_reason}).`
        : `Estado de cita cambiado a ${metadata?.status ?? 'N/A'}.`;

    case 'TENANT_SETTINGS_UPDATED':
      return `Configuración del negocio actualizada (${listUpdatedFields(metadata)}).`;
    case 'TENANT_SETTINGS_ASSET_UPLOADED':
      return `Recurso del negocio subido (${metadata?.asset_type ?? 'N/A'}).`;

    case 'PLATFORM_SETTINGS_UPDATED':
      return `Configuración de plataforma actualizada (${listUpdatedFields(metadata)}).`;
    case 'PLATFORM_SETTINGS_ASSET_UPLOADED':
      return `Recurso de plataforma subido (${metadata?.asset_type ?? 'N/A'}).`;

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
