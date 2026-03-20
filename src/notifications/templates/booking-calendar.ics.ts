import type {
  BookingNotificationBusinessContext,
  BookingNotificationEvent,
  BookingNotificationPayload,
  EmailAttachment,
  MailRecipient,
} from '../notifications.types';

const ICS_LINE_LIMIT = 74;

function normalizeEmail(value: string | null | undefined): string | null {
  const normalized = value?.trim().toLowerCase() ?? '';
  if (!normalized || !normalized.includes('@')) {
    return null;
  }

  return normalized;
}

function formatUtcDateTime(value: Date): string {
  const year = value.getUTCFullYear().toString().padStart(4, '0');
  const month = (value.getUTCMonth() + 1).toString().padStart(2, '0');
  const day = value.getUTCDate().toString().padStart(2, '0');
  const hours = value.getUTCHours().toString().padStart(2, '0');
  const minutes = value.getUTCMinutes().toString().padStart(2, '0');
  const seconds = value.getUTCSeconds().toString().padStart(2, '0');
  return `${year}${month}${day}T${hours}${minutes}${seconds}Z`;
}

function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\r?\n/g, '\\n')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,');
}

function foldIcsLine(line: string): string {
  if (line.length <= ICS_LINE_LIMIT) {
    return line;
  }

  const chunks: string[] = [line.slice(0, ICS_LINE_LIMIT)];
  let remaining = line.slice(ICS_LINE_LIMIT);

  while (remaining.length > 0) {
    chunks.push(` ${remaining.slice(0, ICS_LINE_LIMIT - 1)}`);
    remaining = remaining.slice(ICS_LINE_LIMIT - 1);
  }

  return chunks.join('\r\n');
}

function normalizeUidPart(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9._-]/g, '-');
}

function resolveCalendarMethod(
  event: BookingNotificationEvent,
): 'REQUEST' | 'CANCEL' {
  return event === 'BOOKING_CANCELLED' ? 'CANCEL' : 'REQUEST';
}

function resolveCalendarStatus(input: {
  event: BookingNotificationEvent;
  bookingStatus: BookingNotificationPayload['status'];
}): 'CONFIRMED' | 'TENTATIVE' | 'CANCELLED' {
  if (
    input.event === 'BOOKING_CANCELLED' ||
    input.bookingStatus === 'CANCELLED' ||
    input.bookingStatus === 'NO_SHOW'
  ) {
    return 'CANCELLED';
  }

  if (input.bookingStatus === 'PENDING') {
    return 'TENTATIVE';
  }

  return 'CONFIRMED';
}

function buildCalendarSummary(
  booking: BookingNotificationPayload,
  business: BookingNotificationBusinessContext,
): string {
  const firstService = booking.services.at(0)?.name;
  if (firstService) {
    return `${firstService} - ${business.tenantName}`;
  }

  return `Cita en ${business.tenantName}`;
}

function buildCalendarDescription(input: {
  booking: BookingNotificationPayload;
  business: BookingNotificationBusinessContext;
}): string {
  const services = input.booking.services
    .map((service) => `${service.name} (${service.durationMinutes} min)`)
    .join(', ');

  const lines = [
    `Cliente: ${input.booking.customerName}`,
    `Profesional: ${input.booking.employeeName}`,
    `Estado: ${input.booking.status}`,
    services ? `Servicios: ${services}` : null,
    input.booking.notes ? `Notas: ${input.booking.notes}` : null,
    input.booking.cancellationReason
      ? `Motivo: ${input.booking.cancellationReason}`
      : null,
    `Negocio: ${input.business.tenantName}`,
    `Booking ID: ${input.booking.bookingId}`,
  ];

  return lines.filter(Boolean).join('\n');
}

export function buildBookingCalendarAttachment(input: {
  event: BookingNotificationEvent;
  recipient: MailRecipient;
  business: BookingNotificationBusinessContext;
  booking: BookingNotificationPayload;
}): EmailAttachment | null {
  const recipientEmail = normalizeEmail(input.recipient.email);
  if (!recipientEmail) {
    return null;
  }

  const organizerEmail = normalizeEmail(input.booking.employeeEmail);
  const method = resolveCalendarMethod(input.event);
  const status = resolveCalendarStatus({
    event: input.event,
    bookingStatus: input.booking.status,
  });
  const uid = `${normalizeUidPart(input.booking.bookingId)}-${normalizeUidPart(input.business.tenantId)}@calendar.weegox`;
  const summary = buildCalendarSummary(input.booking, input.business);
  const description = buildCalendarDescription({
    booking: input.booking,
    business: input.business,
  });

  const lines = [
    'BEGIN:VCALENDAR',
    'PRODID:-//Wegox Booking//Booking Calendar//ES',
    'VERSION:2.0',
    'CALSCALE:GREGORIAN',
    `METHOD:${method}`,
    'BEGIN:VEVENT',
    `DTSTAMP:${formatUtcDateTime(new Date())}`,
    `DTSTART:${formatUtcDateTime(input.booking.startAtUtc)}`,
    `DTEND:${formatUtcDateTime(input.booking.endAtUtc)}`,
    `SUMMARY:${escapeIcsText(summary)}`,
    `DESCRIPTION:${escapeIcsText(description)}`,
    `LOCATION:${escapeIcsText(input.business.tenantName)}`,
    `SEQUENCE:${method === 'CANCEL' ? 1 : 0}`,
    `ATTENDEE:mailto:${recipientEmail}`,
    organizerEmail ? `ORGANIZER:mailto:${organizerEmail}` : '',
    'TRANSP:OPAQUE',
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean);

  const content = `${lines.map(foldIcsLine).join('\r\n')}\r\n`;

  return {
    filename: `booking-${input.booking.bookingId}.ics`,
    content,
    contentType: `text/calendar; charset=utf-8; method=${method}`,
  };
}
