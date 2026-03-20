import { buildBookingCalendarAttachment } from './booking-calendar.ics';

describe('buildBookingCalendarAttachment', () => {
  const baseBusiness = {
    tenantId: 'tenant-1',
    tenantName: 'Barberia Centro',
    tenantSlug: 'barberia-centro',
    settingsUpdatedAt: '2026-03-18T10:00:00.000Z',
    logoKey: null,
    branding: {
      appName: 'Barberia Centro',
      windowTitle: 'Barberia Centro',
      logoUrl: '/logo.png',
      faviconUrl: '/favicon.ico',
    },
    theme: {
      primary: '#efc35f',
      secondary: '#f4f4f5',
      tertiary: '#6b7280',
      primaryHover: '#d6ad50',
      secondaryHover: '#ececef',
      tertiaryHover: '#4a4f5b',
      textPrimary: '#1f2937',
      textSecondary: '#4b5563',
      textTertiary: '#6b7280',
    },
  };

  const baseBooking = {
    bookingId: 'booking-1',
    status: 'CONFIRMED',
    customerName: 'Carlos',
    customerEmail: 'carlos@example.com',
    customerPhone: null,
    employeeName: 'Ana',
    employeeEmail: 'ana@example.com',
    employeeTimezone: 'America/Caracas',
    startAtUtc: new Date('2026-03-19T15:00:00.000Z'),
    endAtUtc: new Date('2026-03-19T15:40:00.000Z'),
    durationMinutes: 40,
    totalPrice: '15.00',
    currency: 'USD',
    source: 'MANUAL',
    notes: null,
    cancellationReason: null,
    services: [
      {
        name: 'Corte clasico',
        durationMinutes: 40,
        price: '15.00',
        currency: 'USD',
        instructions: null,
      },
    ],
  };

  it('builds an ICS attachment compatible with booking creation emails', () => {
    const attachment = buildBookingCalendarAttachment({
      event: 'BOOKING_CREATED',
      recipient: {
        email: 'cliente@example.com',
        name: 'Carlos',
      },
      business: baseBusiness,
      booking: baseBooking,
    });

    expect(attachment).not.toBeNull();
    expect(attachment?.filename).toBe('booking-booking-1.ics');
    expect(attachment?.contentType).toContain('text/calendar');
    expect(attachment?.content).toContain('BEGIN:VCALENDAR');
    expect(attachment?.content).toContain('METHOD:REQUEST');
    expect(attachment?.content).toContain('ATTENDEE:mailto:cliente@example.com');
    expect(attachment?.content).toContain('UID:booking-1-tenant-1@calendar.weegox');
    expect(attachment?.content).toContain('STATUS:CONFIRMED');
    expect(attachment?.content).toContain('\r\n');
  });

  it('marks the ICS event as cancelled when booking event is cancelled', () => {
    const attachment = buildBookingCalendarAttachment({
      event: 'BOOKING_CANCELLED',
      recipient: {
        email: 'cliente@example.com',
      },
      business: baseBusiness,
      booking: {
        ...baseBooking,
        status: 'CANCELLED',
        cancellationReason: 'El cliente no podra asistir',
      },
    });

    expect(attachment).not.toBeNull();
    expect(attachment?.content).toContain('METHOD:CANCEL');
    expect(attachment?.content).toContain('STATUS:CANCELLED');
    expect(attachment?.content).toContain('SEQUENCE:1');
  });
});
