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
        ? `Recordatorio: tu cita en ${businessName} es mañana`
        : `Recordatorio: mañana atiendes a ${customerName} en ${businessName}`;
    case 'BOOKING_COMPLETED':
      return audience === 'CUSTOMER'
        ? `Tu cita en ${businessName} fue completada`
        : `Cita completada para ${customerName} en ${businessName}`;
    case 'BOOKING_CANCELLED':
      return audience === 'CUSTOMER'
        ? `Actualización de tu cita en ${businessName}`
        : `Cita cancelada para ${customerName} en ${businessName}`;
    default:
      return `Actualización de cita en ${businessName}`;
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
        ? `Tu cita en ${businessName} ya quedó registrada`
        : 'Se registró una nueva cita en la agenda';
    case 'BOOKING_REMINDER_DAY_BEFORE':
      return audience === 'CUSTOMER'
        ? `Tu cita en ${businessName} es mañana`
        : 'Mañana tienes una cita agendada';
    case 'BOOKING_COMPLETED':
      return audience === 'CUSTOMER'
        ? `Tu cita en ${businessName} fue completada`
        : 'La cita fue marcada como completada';
    case 'BOOKING_CANCELLED':
      return audience === 'CUSTOMER'
        ? `Tu cita en ${businessName} fue actualizada`
        : 'La cita fue cancelada o marcada como no asistida';
    default:
      return 'Actualización de cita';
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
    return `Se agendó una nueva cita para ${booking.customerName}. Aquí tienes el resumen operativo de la cita.`;
  }

  if (event === 'BOOKING_REMINDER_DAY_BEFORE' && audience === 'CUSTOMER') {
    return `Hola ${booking.customerName}, te recordamos que mañana tienes una cita programada. Te dejamos el resumen para que la tengas presente.`;
  }

  if (event === 'BOOKING_REMINDER_DAY_BEFORE') {
    return `Este es tu recordatorio operativo para la cita de mañana con ${booking.customerName}.`;
  }

  if (event === 'BOOKING_COMPLETED' && audience === 'CUSTOMER') {
    return `Hola ${booking.customerName}, gracias por visitarnos. Esta confirmación deja constancia de que tu servicio fue completado.`;
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
    .map((service) => {
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
    })
    .join('');
}

function formatBusinessAddress(
  business: BookingNotificationBusinessContext,
): string | null {
  const parts = [
    business.addressLine,
    business.city,
    business.state,
    business.country,
    business.postalCode,
  ]
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part));

  return parts.length ? parts.join(', ') : null;
}

function buildGoogleMapsUrl(address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

function buildCustomerBusinessInfoMarkup(input: {
  business: BookingNotificationBusinessContext;
  primary: string;
  secondary: string;
  textPrimary: string;
  textSecondary: string;
  tertiary: string;
}): string {
  const { business, primary, secondary, textPrimary, textSecondary, tertiary } =
    input;
  const address = formatBusinessAddress(business);
  const mapsUrl = address ? buildGoogleMapsUrl(address) : null;
  const contactRows = [
    business.phone
      ? `<div style="margin-top: 8px; font-size: 13px; line-height: 1.6; color: ${escapeHtml(textSecondary)};"><strong style="color: ${escapeHtml(textPrimary)};">Teléfono:</strong> ${escapeHtml(business.phone)}</div>`
      : '',
    business.publicEmail
      ? `<div style="margin-top: 8px; font-size: 13px; line-height: 1.6; color: ${escapeHtml(textSecondary)};"><strong style="color: ${escapeHtml(textPrimary)};">Correo:</strong> ${escapeHtml(business.publicEmail)}</div>`
      : '',
    address
      ? `<div style="margin-top: 8px; font-size: 13px; line-height: 1.6; color: ${escapeHtml(textSecondary)};"><strong style="color: ${escapeHtml(textPrimary)};">Dirección:</strong> ${escapeHtml(address)}</div>`
      : '',
  ].join('');

  if (!contactRows && !mapsUrl) {
    return '';
  }

  return `
            <tr>
              <td class="email-section" style="padding: 14px 30px 0;">
                <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse: separate; border-spacing: 0; background: ${escapeHtml(withAlpha(secondary, 0.24))}; border: 1px solid ${escapeHtml(withAlpha(primary, 0.16))}; border-radius: 18px;">
                  <tr>
                    <td style="padding: 18px 20px;">
                      <div style="font-size: 13px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; color: ${escapeHtml(tertiary)};">Información para tu visita</div>
                      <div style="margin-top: 10px; font-size: 15px; font-weight: 800; color: ${escapeHtml(textPrimary)};">${escapeHtml(business.tenantName)}</div>
                      ${contactRows}
                      ${
                        mapsUrl
                          ? `<a href="${escapeHtml(mapsUrl)}" style="display: inline-block; margin-top: 14px; padding: 11px 16px; border-radius: 14px; background: #ffffff; border: 1px solid ${escapeHtml(withAlpha(primary, 0.28))}; color: ${escapeHtml(textPrimary)}; font-size: 13px; font-weight: 800; text-decoration: none;">Como llegar</a>`
                          : ''
                      }
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
  `;
}

export function buildBookingLifecycleEmail(input: {
  event: BookingNotificationEvent;
  audience: BookingNotificationAudience;
  business: BookingNotificationBusinessContext;
  booking: BookingNotificationPayload;
  appPublicUrl: string;
  assetBaseUrl?: string | null;
  managementUrl?: string | null;
}): { subject: string; html: string; text: string } {
  const {
    event,
    audience,
    business,
    booking,
    appPublicUrl,
    assetBaseUrl,
    managementUrl,
  } = input;
  const subject = getSubject(
    event,
    audience,
    business.tenantName,
    booking.customerName,
  );
  const headline = getHeadline(event, audience, business.tenantName);
  const intro = getIntro(event, audience, booking);
  const startAtText = formatDateTime(
    booking.startAtUtc,
    booking.employeeTimezone || 'UTC',
  );
  const endAtText = formatDateTime(
    booking.endAtUtc,
    booking.employeeTimezone || 'UTC',
  );
  const normalizedAssetBaseUrl =
    assetBaseUrl?.trim().replace(/\/+$/, '') || null;
  const logoSourceUrl =
    business.logoKey && normalizedAssetBaseUrl
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
  const statusLabel = booking.status.replace(/_/g, ' ');
  const customerBusinessInfoMarkup =
    audience === 'CUSTOMER'
      ? buildCustomerBusinessInfoMarkup({
          business,
          primary,
          secondary,
          textPrimary,
          textSecondary,
          tertiary,
        })
      : '';

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
  const managementMarkup =
    audience === 'CUSTOMER' && managementUrl
      ? `
            <tr>
              <td class="email-section" style="padding: 16px 30px 0;">
                <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse: separate; border-spacing: 0; background: ${escapeHtml(withAlpha(primary, 0.1))}; border: 1px solid ${escapeHtml(withAlpha(primary, 0.22))}; border-radius: 18px;">
                  <tr>
                    <td style="padding: 18px 20px;">
                      <div style="font-size: 15px; font-weight: 800; color: ${escapeHtml(textPrimary)};">¿Necesitas cambiar la fecha?</div>
                      <div style="margin-top: 7px; font-size: 13px; line-height: 1.7; color: ${escapeHtml(textSecondary)};">Puedes reprogramar esta cita desde un enlace seguro. El enlace es personal para esta reserva.</div>
                      <a href="${escapeHtml(managementUrl)}" style="display: inline-block; margin-top: 14px; padding: 12px 18px; border-radius: 14px; background: ${escapeHtml(primary)}; color: #ffffff; font-size: 14px; font-weight: 800; text-decoration: none;">Reprogramar cita</a>
                    </td>
                  </tr>
                </table>
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
          padding: 12px 8px !important;
        }

        .email-card {
          border-radius: 18px !important;
        }

        .email-header,
        .email-section,
        .email-footer {
          padding-left: 18px !important;
          padding-right: 18px !important;
        }

        .email-header {
          padding-top: 24px !important;
          padding-bottom: 20px !important;
        }

        .stack-mobile,
        .stack-mobile > tbody,
        .stack-mobile > tbody > tr,
        .stack-mobile > tbody > tr > td {
          display: block !important;
          width: 100% !important;
        }

        .logo-cell,
        .footer-secondary {
          padding-left: 0 !important;
          padding-top: 14px !important;
          text-align: left !important;
        }

        .hero-title {
          font-size: 27px !important;
          line-height: 1.2 !important;
        }

        .hero-copy {
          font-size: 14px !important;
          line-height: 1.6 !important;
        }

        .summary-grid td,
        .service-row td {
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

        .meta-chip {
          margin-left: 0 !important;
          margin-right: 8px !important;
        }
      }
    </style>
  </head>
  <body style="margin: 0; padding: 0; background: ${escapeHtml(withAlpha(secondary, 0.25))}; font-family: Arial, Helvetica, sans-serif; color: ${escapeHtml(textPrimary)}; word-break: break-word;">
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" class="email-wrapper" style="padding: 20px 12px; background: linear-gradient(180deg, ${escapeHtml(withAlpha(primary, 0.14))} 0%, ${escapeHtml(withAlpha(secondary, 0.18))} 100%);">
      <tr>
        <td align="center">
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%" class="email-card" style="max-width: 680px; background: #ffffff; border-radius: 24px; overflow: hidden; border: 1px solid ${escapeHtml(withAlpha(primary, 0.14))}; box-shadow: 0 18px 44px ${escapeHtml(withAlpha(primary, 0.14))};">
            <tr>
              <td class="email-header" style="padding: 30px 30px 24px; background: linear-gradient(135deg, ${escapeHtml(primary)} 0%, ${escapeHtml(withAlpha(primary, 0.86))} 100%);">
                <table role="presentation" cellpadding="0" cellspacing="0" width="100%" class="stack-mobile">
                  <tr>
                    <td style="vertical-align: middle;">
                      <div style="display: inline-block; padding: 8px 14px; border-radius: 999px; background: ${escapeHtml(withAlpha('#ffffff', 0.18))}; color: #ffffff; font-size: 11px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase;">
                        ${escapeHtml(business.branding.appName || business.tenantName)}
                      </div>
                      <div class="hero-title" style="margin-top: 16px; font-size: 31px; line-height: 1.2; font-weight: 800; color: #ffffff;">
                        ${escapeHtml(headline)}
                      </div>
                      <div class="hero-copy" style="margin-top: 12px; font-size: 15px; line-height: 1.7; color: rgba(255,255,255,0.92);">
                        ${escapeHtml(intro)}
                      </div>
                    </td>
                    <td class="logo-cell" align="right" style="vertical-align: top; padding-left: 16px;">
                      <img src="${escapeHtml(logoUrl)}" alt="${escapeHtml(business.tenantName)}" style="max-width: 124px; max-height: 64px; object-fit: contain; border-radius: 12px; background: rgba(255,255,255,0.16); padding: 10px;" />
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <tr>
              <td class="email-section" style="padding: 26px 30px 0;">
                <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse: separate; border-spacing: 0; background: ${escapeHtml(withAlpha(secondary, 0.22))}; border: 1px solid ${escapeHtml(withAlpha(primary, 0.16))}; border-radius: 18px;">
                  <tr>
                    <td style="padding: 20px 20px 8px;">
                      <div style="font-size: 13px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: ${escapeHtml(tertiary)};">Resumen de la cita</div>
                      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" class="summary-grid" style="margin-top: 16px;">
                        <tr>
                          <td style="padding: 0 0 12px; width: 50%; vertical-align: top;">
                            <div style="font-size: 12px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: ${escapeHtml(tertiary)};">Cliente</div>
                            <div style="margin-top: 6px; font-size: 15px; font-weight: 700; color: ${escapeHtml(textPrimary)};">${escapeHtml(booking.customerName)}</div>
                          </td>
                          <td style="padding: 0 0 12px; width: 50%; vertical-align: top;">
                            <div style="font-size: 12px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: ${escapeHtml(tertiary)};">Profesional</div>
                            <div style="margin-top: 6px; font-size: 15px; font-weight: 700; color: ${escapeHtml(textPrimary)};">${escapeHtml(booking.employeeName)}</div>
                          </td>
                        </tr>
                        <tr>
                          <td style="padding: 0 0 12px; width: 50%; vertical-align: top;">
                            <div style="font-size: 12px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: ${escapeHtml(tertiary)};">Inicio</div>
                            <div style="margin-top: 6px; font-size: 14px; line-height: 1.7; color: ${escapeHtml(textPrimary)};">${escapeHtml(startAtText)}</div>
                          </td>
                          <td style="padding: 0 0 12px; width: 50%; vertical-align: top;">
                            <div style="font-size: 12px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: ${escapeHtml(tertiary)};">Fin</div>
                            <div style="margin-top: 6px; font-size: 14px; line-height: 1.7; color: ${escapeHtml(textPrimary)};">${escapeHtml(endAtText)}</div>
                          </td>
                        </tr>
                        <tr>
                          <td style="padding: 0 0 12px; width: 50%; vertical-align: top;">
                            <div style="font-size: 12px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: ${escapeHtml(tertiary)};">Duración total</div>
                            <div style="margin-top: 6px; font-size: 14px; line-height: 1.7; color: ${escapeHtml(textPrimary)};">${escapeHtml(formatDuration(booking.durationMinutes))}</div>
                          </td>
                          <td style="padding: 0 0 12px; width: 50%; vertical-align: top;">
                            <div style="font-size: 12px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: ${escapeHtml(tertiary)};">Estado actual</div>
                            <span style="display: inline-block; margin-top: 7px; padding: 5px 11px; border-radius: 999px; border: 1px solid ${escapeHtml(withAlpha(primary, 0.2))}; background: ${escapeHtml(withAlpha(primary, 0.13))}; font-size: 12px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase; color: ${escapeHtml(textPrimary)};">
                              ${escapeHtml(statusLabel)}
                            </span>
                          </td>
                        </tr>
                      </table>
                      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin-top: 2px;">
                        ${reasonMarkup}
                        ${notesMarkup}
                      </table>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <tr>
              <td class="email-section" style="padding: 14px 30px 0;">
                <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse: collapse;">
                  <tr>
                    <td style="padding: 20px 20px; border: 1px solid ${escapeHtml(withAlpha(primary, 0.16))}; border-radius: 18px; background: #ffffff;">
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

            ${customerBusinessInfoMarkup}

            ${managementMarkup}

            <tr>
              <td class="email-footer" style="padding: 24px 30px 28px; background: linear-gradient(180deg, ${escapeHtml(withAlpha(secondary, 0.2))} 0%, #ffffff 100%); border-top: 1px solid ${escapeHtml(withAlpha(primary, 0.12))};">
                <table role="presentation" cellpadding="0" cellspacing="0" width="100%" class="stack-mobile">
                  <tr>
                    <td style="vertical-align: top;">
                      <div style="font-size: 16px; font-weight: 800; color: ${escapeHtml(textPrimary)};">${escapeHtml(business.tenantName)}</div>
                      <div style="margin-top: 6px; font-size: 12px; line-height: 1.7; color: ${escapeHtml(textSecondary)};">
                        Todos los derechos reservados &copy; ${currentYear}. Este correo fue generado automáticamente por ${escapeHtml(business.branding.appName || business.tenantName)}.
                      </div>
                      <div style="margin-top: 8px; font-size: 12px; line-height: 1.7; color: ${escapeHtml(textTertiary)};">
                        Impulsado por Wegox para reservas, agenda y operaciones del negocio.
                      </div>
                    </td>
                    <td class="footer-secondary" align="right" style="vertical-align: top; padding-left: 18px;">
                      <div style="display: inline-block; padding: 8px 14px; border-radius: 999px; background: ${escapeHtml(withAlpha(primary, 0.12))}; color: ${escapeHtml(textPrimary)}; font-size: 11px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase;">
                        Powered by Wegox
                      </div>
                      <span class="meta-chip" style="display: inline-block; margin: 10px 0 0 8px; padding: 9px 12px; border-radius: 12px; background: #ffffff; border: 1px solid ${escapeHtml(withAlpha(primary, 0.14))}; font-size: 12px; line-height: 1.5; color: ${escapeHtml(textSecondary)};">
                        Fuente: ${escapeHtml(booking.source)}
                      </span>
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
    `Estado: ${statusLabel}`,
    `Duración: ${formatDuration(booking.durationMinutes)}`,
    `Total: ${formatMoney(booking.totalPrice, booking.currency)}`,
    booking.cancellationReason ? `Motivo: ${booking.cancellationReason}` : '',
    booking.notes ? `Notas: ${booking.notes}` : '',
    managementUrl ? `Reprogramar cita: ${managementUrl}` : '',
    '',
    'Servicios:',
    ...booking.services.map(
      (service) =>
        `- ${service.name} (${formatDuration(service.durationMinutes)}) - ${formatMoney(service.price, service.currency)}${service.instructions ? ` | Indicaciones: ${service.instructions}` : ''}`,
    ),
    audience === 'CUSTOMER' ? '' : '',
    audience === 'CUSTOMER' ? 'Información para tu visita:' : '',
    audience === 'CUSTOMER' ? `Negocio: ${business.tenantName}` : '',
    audience === 'CUSTOMER' && business.phone
      ? `Teléfono: ${business.phone}`
      : '',
    audience === 'CUSTOMER' && business.publicEmail
      ? `Correo: ${business.publicEmail}`
      : '',
    audience === 'CUSTOMER' && formatBusinessAddress(business)
      ? `Dirección: ${formatBusinessAddress(business)}`
      : '',
    audience === 'CUSTOMER' && formatBusinessAddress(business)
      ? `Como llegar: ${buildGoogleMapsUrl(formatBusinessAddress(business)!)}`
      : '',
    '',
    `Negocio: ${business.tenantName}`,
    `Powered by Wegox`,
    `Fuente: ${booking.source}`,
  ]
    .filter(Boolean)
    .join('\n');

  return { subject, html, text };
}
