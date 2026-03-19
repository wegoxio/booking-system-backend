import type {
  BookingNotificationAudience,
  BookingNotificationBusinessContext,
  BookingNotificationEvent,
  BookingNotificationPayload,
} from '../notifications.types';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function hexToRgb(color: string): [number, number, number] {
  const normalized = color.replace('#', '').trim();
  const value =
    normalized.length === 3
      ? normalized
          .split('')
          .map((char) => char + char)
          .join('')
      : normalized;

  if (!/^[0-9a-fA-F]{6}$/.test(value)) {
    return [239, 195, 95];
  }

  return [
    Number.parseInt(value.slice(0, 2), 16),
    Number.parseInt(value.slice(2, 4), 16),
    Number.parseInt(value.slice(4, 6), 16),
  ];
}

function withAlpha(color: string, alpha: number): string {
  const [r, g, b] = hexToRgb(color);
  const normalizedAlpha = Math.max(0, Math.min(alpha, 1));
  return `rgba(${r}, ${g}, ${b}, ${normalizedAlpha})`;
}

function appendCacheBuster(url: string, version: string): string {
  if (!version.trim()) return url;

  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}v=${encodeURIComponent(version)}`;
}

function formatDateTime(value: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('es-ES', {
    dateStyle: 'full',
    timeStyle: 'short',
    timeZone,
  }).format(value);
}

function formatMoney(value: string, currency: string): string {
  const amount = Number(value);

  try {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;

  if (hours <= 0) return `${minutes} min`;
  if (remaining === 0) return `${hours} h`;
  return `${hours} h ${remaining} min`;
}

function getSubject(
  event: BookingNotificationEvent,
  audience: BookingNotificationAudience,
  businessName: string,
  customerName: string,
): string {
  switch (event) {
    case 'BOOKING_CREATED':
      return audience === 'CUSTOMER'
        ? `Tu cita en ${businessName} fue registrada`
        : `Nueva cita agendada para ${customerName} en ${businessName}`;
    case 'BOOKING_REMINDER_DAY_BEFORE':
      return audience === 'CUSTOMER'
        ? `Recordatorio: tu cita en ${businessName} es manana`
        : `Recordatorio: manana atiendes a ${customerName} en ${businessName}`;
    case 'BOOKING_COMPLETED':
      return audience === 'CUSTOMER'
        ? `Tu cita en ${businessName} fue completada`
        : `Cita completada para ${customerName} en ${businessName}`;
    case 'BOOKING_CANCELLED':
      return audience === 'CUSTOMER'
        ? `Actualizacion de tu cita en ${businessName}`
        : `Cita cancelada para ${customerName} en ${businessName}`;
    default:
      return `Actualizacion de booking en ${businessName}`;
  }
}

function getHeadline(
  event: BookingNotificationEvent,
  audience: BookingNotificationAudience,
  businessName: string,
): string {
  switch (event) {
    case 'BOOKING_CREATED':
      return audience === 'CUSTOMER'
        ? `Tu cita en ${businessName} ya quedo registrada`
        : 'Se registro una nueva cita en la agenda';
    case 'BOOKING_REMINDER_DAY_BEFORE':
      return audience === 'CUSTOMER'
        ? `Tu cita en ${businessName} es manana`
        : 'Manana tienes una cita agendada';
    case 'BOOKING_COMPLETED':
      return audience === 'CUSTOMER'
        ? `Tu cita en ${businessName} fue completada`
        : 'La cita fue marcada como completada';
    case 'BOOKING_CANCELLED':
      return audience === 'CUSTOMER'
        ? `Tu cita en ${businessName} fue actualizada`
        : 'La cita fue cancelada o marcada como no asistida';
    default:
      return 'Actualizacion de booking';
  }
}

function getIntro(
  event: BookingNotificationEvent,
  audience: BookingNotificationAudience,
  booking: BookingNotificationPayload,
): string {
  if (event === 'BOOKING_CREATED' && audience === 'CUSTOMER') {
    return `Hola ${booking.customerName}, te compartimos el resumen de tu reserva para que tengas todos los detalles a mano.`;
  }

  if (event === 'BOOKING_CREATED') {
    return `Se agendo una nueva cita para ${booking.customerName}. Aqui tienes el resumen operativo del booking.`;
  }

  if (event === 'BOOKING_REMINDER_DAY_BEFORE' && audience === 'CUSTOMER') {
    return `Hola ${booking.customerName}, te recordamos que manana tienes una cita programada. Te dejamos el resumen para que la tengas presente.`;
  }

  if (event === 'BOOKING_REMINDER_DAY_BEFORE') {
    return `Este es tu recordatorio operativo para la cita de manana con ${booking.customerName}.`;
  }

  if (event === 'BOOKING_COMPLETED' && audience === 'CUSTOMER') {
    return `Hola ${booking.customerName}, gracias por visitarnos. Esta confirmacion deja constancia de que tu servicio fue completado.`;
  }

  if (event === 'BOOKING_COMPLETED') {
    return `La cita de ${booking.customerName} fue cerrada como completada.`;
  }

  if (audience === 'CUSTOMER') {
    return `Hola ${booking.customerName}, tu cita fue cancelada o marcada como no asistida. Te dejamos el detalle actualizado.`;
  }

  return `La cita de ${booking.customerName} fue cancelada o marcada como no asistida y la agenda ya fue liberada.`;
}

function buildServicesMarkup(booking: BookingNotificationPayload): string {
  return booking.services
    .map(
      (service) => {
        const instructionsMarkup = service.instructions
          ? `<div style="margin-top: 8px; font-size: 12px; line-height: 1.6; color: #92400e;">Indicaciones: ${escapeHtml(service.instructions)}</div>`
          : '';

        return `
        <tr class="service-row">
          <td style="padding: 10px 0; border-bottom: 1px solid rgba(148,163,184,0.16);">
            <div style="font-size: 14px; font-weight: 700; color: #111827;">${escapeHtml(service.name)}</div>
            <div style="margin-top: 4px; font-size: 12px; color: #6b7280;">${escapeHtml(formatDuration(service.durationMinutes))}</div>
            ${instructionsMarkup}
          </td>
          <td class="service-price-cell" style="padding: 10px 0; border-bottom: 1px solid rgba(148,163,184,0.16); text-align: right; font-size: 13px; font-weight: 700; color: #111827;">
            <div style="display: inline-block;">${escapeHtml(formatMoney(service.price, service.currency))}</div>
          </td>
        </tr>
      `;
      },
    )
    .join('');
}

export function buildBookingLifecycleEmail(input: {
  event: BookingNotificationEvent;
  audience: BookingNotificationAudience;
  business: BookingNotificationBusinessContext;
  booking: BookingNotificationPayload;
  appPublicUrl: string;
  assetBaseUrl?: string | null;
}): { subject: string; html: string; text: string } {
  const { event, audience, business, booking, appPublicUrl, assetBaseUrl } = input;
  const subject = getSubject(event, audience, business.tenantName, booking.customerName);
  const headline = getHeadline(event, audience, business.tenantName);
  const intro = getIntro(event, audience, booking);
  const startAtText = formatDateTime(booking.startAtUtc, booking.employeeTimezone || 'UTC');
  const endAtText = formatDateTime(booking.endAtUtc, booking.employeeTimezone || 'UTC');
  const normalizedAssetBaseUrl = assetBaseUrl?.trim().replace(/\/+$/, '') || null;
  const logoSourceUrl = business.logoKey && normalizedAssetBaseUrl
    ? `${normalizedAssetBaseUrl}/${business.logoKey.replace(/^\/+/, '')}`
      : business.branding.logoUrl.startsWith('http')
        ? business.branding.logoUrl
        : normalizedAssetBaseUrl
          ? `${normalizedAssetBaseUrl}/${business.branding.logoUrl.replace(/^\/+/, '')}`
          : new URL(business.branding.logoUrl, appPublicUrl).toString();
  const logoUrl = appendCacheBuster(logoSourceUrl, business.settingsUpdatedAt);
  const currentYear = new Date().getUTCFullYear();

  const primary = business.theme.primary || '#efc35f';
  const secondary = business.theme.secondary || '#f4f4f5';
  const tertiary = business.theme.tertiary || '#6b7280';
  const textPrimary = business.theme.textPrimary || '#1f2937';
  const textSecondary = business.theme.textSecondary || '#4b5563';
  const textTertiary = business.theme.textTertiary || '#6b7280';

  const reasonMarkup = booking.cancellationReason
    ? `
      <tr>
        <td style="padding: 0 0 10px; vertical-align: top;">
          <div style="font-size: 12px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: ${escapeHtml(tertiary)};">Motivo</div>
          <div style="margin-top: 6px; font-size: 14px; line-height: 1.7; color: ${escapeHtml(textPrimary)};">${escapeHtml(booking.cancellationReason)}</div>
        </td>
      </tr>
    `
    : '';

  const notesMarkup = booking.notes
    ? `
      <tr>
        <td style="padding: 0 0 10px; vertical-align: top;">
          <div style="font-size: 12px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: ${escapeHtml(tertiary)};">Notas</div>
          <div style="margin-top: 6px; font-size: 14px; line-height: 1.7; color: ${escapeHtml(textPrimary)};">${escapeHtml(booking.notes)}</div>
        </td>
      </tr>
    `
    : '';

  const html = `
<!DOCTYPE html>
<html lang="es">
  <head>
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <style>
      @media screen and (max-width: 640px) {
        .email-wrapper {
          padding: 14px 10px !important;
        }

        .email-card {
          border-radius: 22px !important;
        }

        .email-hero,
        .email-section,
        .email-footer {
          padding-left: 20px !important;
          padding-right: 20px !important;
        }

        .email-hero {
          padding-top: 24px !important;
          padding-bottom: 18px !important;
        }

        .mobile-stack,
        .mobile-stack > tbody,
        .mobile-stack > tbody > tr {
          display: block !important;
          width: 100% !important;
        }

        .mobile-stack-cell {
          display: block !important;
          width: 100% !important;
        }

        .mobile-logo-cell,
        .footer-meta-cell {
          display: block !important;
          width: 100% !important;
          padding-left: 0 !important;
          padding-top: 18px !important;
          text-align: left !important;
        }

        .hero-title {
          font-size: 28px !important;
          line-height: 1.18 !important;
        }

        .hero-copy {
          font-size: 14px !important;
          line-height: 1.65 !important;
        }

        .summary-grid td,
        .service-row td,
        .footer-branding td {
          display: block !important;
          width: 100% !important;
          text-align: left !important;
        }

        .summary-grid td {
          padding-bottom: 14px !important;
        }

        .service-price-cell {
          padding-top: 0 !important;
        }

        .meta-pill {
          display: block !important;
          width: 100% !important;
          margin: 8px 0 0 !important;
          box-sizing: border-box !important;
        }
      }
    </style>
  </head>
  <body style="margin: 0; padding: 0; background: ${escapeHtml(withAlpha(secondary, 0.25))}; font-family: Arial, Helvetica, sans-serif; color: ${escapeHtml(textPrimary)}; word-break: break-word;">
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" class="email-wrapper" style="padding: 24px 12px; background: linear-gradient(180deg, ${escapeHtml(withAlpha(primary, 0.18))} 0%, ${escapeHtml(withAlpha(secondary, 0.18))} 100%);">
      <tr>
        <td align="center">
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%" class="email-card" style="max-width: 720px; background: #ffffff; border-radius: 28px; overflow: hidden; box-shadow: 0 22px 60px ${escapeHtml(withAlpha(primary, 0.18))};">
            <tr>
              <td style="padding: 0; background: linear-gradient(135deg, ${escapeHtml(primary)} 0%, ${escapeHtml(withAlpha(primary, 0.84))} 100%);">
                <table role="presentation" cellpadding="0" cellspacing="0" width="100%" class="mobile-stack">
                  <tr>
                    <td class="email-hero mobile-stack-cell" style="padding: 32px 32px 20px;">
                      <div style="display: inline-block; padding: 8px 14px; border-radius: 999px; background: ${escapeHtml(withAlpha('#ffffff', 0.18))}; color: #ffffff; font-size: 11px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase;">
                        ${escapeHtml(business.branding.appName || business.tenantName)}
                      </div>
                      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" class="mobile-stack" style="margin-top: 18px;">
                        <tr>
                          <td class="mobile-stack-cell" style="vertical-align: middle;">
                            <div class="hero-title" style="font-size: 32px; line-height: 1.2; font-weight: 800; color: #ffffff;">
                              ${escapeHtml(headline)}
                            </div>
                            <div class="hero-copy" style="margin-top: 12px; font-size: 15px; line-height: 1.7; color: rgba(255,255,255,0.92);">
                              ${escapeHtml(intro)}
                            </div>
                          </td>
                          <td class="mobile-stack-cell mobile-logo-cell" align="right" style="vertical-align: top; padding-left: 16px;">
                            <img src="${escapeHtml(logoUrl)}" alt="${escapeHtml(business.tenantName)}" style="max-width: 120px; max-height: 60px; object-fit: contain; border-radius: 12px; background: rgba(255,255,255,0.12); padding: 10px;" />
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <tr>
              <td class="email-section" style="padding: 28px 32px 12px;">
                <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse: separate; border-spacing: 0; background: ${escapeHtml(withAlpha(secondary, 0.28))}; border: 1px solid ${escapeHtml(withAlpha(primary, 0.16))}; border-radius: 24px;">
                  <tr>
                    <td style="padding: 24px;">
                      <div style="font-size: 13px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: ${escapeHtml(tertiary)};">Resumen del booking</div>
                      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" class="summary-grid" style="margin-top: 18px;">
                        <tr>
                          <td style="padding: 0 0 10px; width: 50%; vertical-align: top;">
                            <div style="font-size: 12px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: ${escapeHtml(tertiary)};">Cliente</div>
                            <div style="margin-top: 6px; font-size: 15px; font-weight: 700; color: ${escapeHtml(textPrimary)};">${escapeHtml(booking.customerName)}</div>
                            <div style="margin-top: 4px; font-size: 13px; color: ${escapeHtml(textSecondary)};">${escapeHtml(booking.customerEmail ?? booking.customerPhone ?? 'Sin contacto registrado')}</div>
                          </td>
                          <td style="padding: 0 0 10px; width: 50%; vertical-align: top;">
                            <div style="font-size: 12px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: ${escapeHtml(tertiary)};">Profesional</div>
                            <div style="margin-top: 6px; font-size: 15px; font-weight: 700; color: ${escapeHtml(textPrimary)};">${escapeHtml(booking.employeeName)}</div>
                            <div style="margin-top: 4px; font-size: 13px; color: ${escapeHtml(textSecondary)};">${escapeHtml(booking.employeeEmail)}</div>
                          </td>
                        </tr>
                        <tr>
                          <td style="padding: 0 0 10px; width: 50%; vertical-align: top;">
                            <div style="font-size: 12px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: ${escapeHtml(tertiary)};">Inicio</div>
                            <div style="margin-top: 6px; font-size: 14px; line-height: 1.7; color: ${escapeHtml(textPrimary)};">${escapeHtml(startAtText)}</div>
                          </td>
                          <td style="padding: 0 0 10px; width: 50%; vertical-align: top;">
                            <div style="font-size: 12px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: ${escapeHtml(tertiary)};">Fin</div>
                            <div style="margin-top: 6px; font-size: 14px; line-height: 1.7; color: ${escapeHtml(textPrimary)};">${escapeHtml(endAtText)}</div>
                          </td>
                        </tr>
                        <tr>
                          <td style="padding: 0 0 10px; width: 50%; vertical-align: top;">
                            <div style="font-size: 12px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: ${escapeHtml(tertiary)};">Duracion total</div>
                            <div style="margin-top: 6px; font-size: 14px; line-height: 1.7; color: ${escapeHtml(textPrimary)};">${escapeHtml(formatDuration(booking.durationMinutes))}</div>
                          </td>
                          <td style="padding: 0 0 10px; width: 50%; vertical-align: top;">
                            <div style="font-size: 12px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: ${escapeHtml(tertiary)};">Estado actual</div>
                            <div style="margin-top: 6px; font-size: 14px; line-height: 1.7; color: ${escapeHtml(textPrimary)};">${escapeHtml(booking.status)}</div>
                          </td>
                        </tr>
                        ${reasonMarkup}
                        ${notesMarkup}
                      </table>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <tr>
              <td class="email-section" style="padding: 8px 32px 0;">
                <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse: collapse;">
                  <tr>
                    <td style="padding: 22px 24px; border: 1px solid ${escapeHtml(withAlpha(primary, 0.16))}; border-radius: 24px; background: #ffffff;">
                      <div style="font-size: 13px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: ${escapeHtml(tertiary)};">Servicios incluidos</div>
                      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin-top: 12px; border-collapse: collapse;">
                        ${buildServicesMarkup(booking)}
                      </table>
                      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin-top: 14px;">
                        <tr>
                          <td style="font-size: 13px; color: ${escapeHtml(textSecondary)};">Total</td>
                          <td align="right" style="font-size: 16px; font-weight: 800; color: ${escapeHtml(textPrimary)};">${escapeHtml(formatMoney(booking.totalPrice, booking.currency))}</td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <tr>
              <td class="email-footer" style="padding: 24px 32px 30px; background: linear-gradient(180deg, ${escapeHtml(withAlpha(secondary, 0.22))} 0%, #ffffff 100%); border-top: 1px solid ${escapeHtml(withAlpha(primary, 0.12))};">
                <table role="presentation" cellpadding="0" cellspacing="0" width="100%" class="footer-branding">
                  <tr>
                    <td style="vertical-align: top;">
                      <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
                        <tr>
                          <td width="76" style="padding-right: 14px; vertical-align: top;">
                            <img src="${escapeHtml(logoUrl)}" alt="${escapeHtml(business.tenantName)}" style="width: 58px; height: 58px; object-fit: contain; border-radius: 16px; background: ${escapeHtml(withAlpha('#ffffff', 0.9))}; border: 1px solid ${escapeHtml(withAlpha(primary, 0.14))}; padding: 8px;" />
                          </td>
                          <td style="vertical-align: top;">
                            <div style="font-size: 16px; font-weight: 800; color: ${escapeHtml(textPrimary)};">${escapeHtml(business.tenantName)}</div>
                            <div style="margin-top: 6px; font-size: 12px; line-height: 1.7; color: ${escapeHtml(textSecondary)};">
                              Todos los derechos reservados &copy; ${currentYear}. Este correo fue generado automaticamente por ${escapeHtml(business.branding.appName || business.tenantName)}.
                            </div>
                            <div style="margin-top: 10px; font-size: 12px; line-height: 1.7; color: ${escapeHtml(textTertiary)};">
                              Impulsado por Wegox para reservas, agenda y operaciones del negocio.
                            </div>
                          </td>
                        </tr>
                      </table>
                    </td>
                    <td class="footer-meta-cell" align="right" style="vertical-align: top; padding-left: 18px;">
                      <div style="display: inline-block; padding: 8px 14px; border-radius: 999px; background: ${escapeHtml(withAlpha(primary, 0.12))}; color: ${escapeHtml(textPrimary)}; font-size: 11px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase;">
                        Powered by Wegox
                      </div>
                      <div style="margin-top: 12px;">
                        <span class="meta-pill" style="display: inline-block; max-width: 100%; margin: 0 0 0 8px; padding: 9px 12px; border-radius: 12px; background: #ffffff; border: 1px solid ${escapeHtml(withAlpha(primary, 0.14))}; font-size: 12px; line-height: 1.5; color: ${escapeHtml(textSecondary)}; word-break: break-word;">
                          Booking ID: ${escapeHtml(booking.bookingId)}
                        </span>
                        <span class="meta-pill" style="display: inline-block; margin: 8px 0 0 8px; padding: 9px 12px; border-radius: 12px; background: #ffffff; border: 1px solid ${escapeHtml(withAlpha(primary, 0.14))}; font-size: 12px; line-height: 1.5; color: ${escapeHtml(textSecondary)};">
                          Fuente: ${escapeHtml(booking.source)}
                        </span>
                      </div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
  `.trim();

  const text = [
    subject,
    '',
    headline,
    intro,
    '',
    `Cliente: ${booking.customerName}`,
    `Profesional: ${booking.employeeName}`,
    `Inicio: ${startAtText}`,
    `Fin: ${endAtText}`,
    `Estado: ${booking.status}`,
    `Duracion: ${formatDuration(booking.durationMinutes)}`,
    `Total: ${formatMoney(booking.totalPrice, booking.currency)}`,
    booking.cancellationReason ? `Motivo: ${booking.cancellationReason}` : '',
    booking.notes ? `Notas: ${booking.notes}` : '',
    '',
    'Servicios:',
    ...booking.services.map(
      (service) =>
        `- ${service.name} (${formatDuration(service.durationMinutes)}) - ${formatMoney(service.price, service.currency)}${service.instructions ? ` | Indicaciones: ${service.instructions}` : ''}`,
    ),
    '',
    `Negocio: ${business.tenantName}`,
    `Powered by Wegox`,
    `Booking ID: ${booking.bookingId}`,
  ]
    .filter(Boolean)
    .join('\n');

  return { subject, html, text };
}
