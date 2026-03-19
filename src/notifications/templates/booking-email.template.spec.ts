import { buildBookingLifecycleEmail } from './booking-email.template';

describe('buildBookingLifecycleEmail', () => {
  it('includes service instructions in html and text outputs', () => {
    const rendered = buildBookingLifecycleEmail({
      event: 'BOOKING_CREATED',
      audience: 'CUSTOMER',
      appPublicUrl: 'https://app.example.com',
      assetBaseUrl: 'https://cdn.example.com',
      business: {
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
      },
      booking: {
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
            instructions: 'Llegar con el cabello limpio.',
          },
        ],
      },
    });

    expect(rendered.html).toContain('Indicaciones');
    expect(rendered.html).toContain('Llegar con el cabello limpio.');
    expect(rendered.text).toContain('Indicaciones: Llegar con el cabello limpio.');
  });
});
