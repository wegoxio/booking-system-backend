import { Booking } from 'src/bookings/entities/booking.entity';
import { BookingItem } from 'src/bookings/entities/booking-item.entity';
import { Employee } from 'src/employees/entities/employee.entity';
import { NotificationsService } from 'src/notifications/notifications.service';
import { Service } from 'src/services/entity/service.entity';
import { RemindersService } from './reminders.service';
import { BookingReminder } from './entities/booking-reminder.entity';

type MockRepo<T> = {
  find: jest.Mock;
  save: jest.Mock;
  create: jest.Mock;
  update: jest.Mock;
  createQueryBuilder: jest.Mock;
};

function createConfigMock(
  overrides: Partial<Record<string, unknown>> = {},
): { get: jest.Mock } {
  const values: Record<string, unknown> = {
    REMINDERS_ENABLED: true,
    REMINDERS_TIMEZONE: 'America/Caracas',
    REMINDERS_DISPATCH_HOUR: 17,
    REMINDERS_DISPATCH_MINUTE: 0,
    REMINDERS_BATCH_SIZE: 25,
    REMINDERS_MAX_ATTEMPTS: 3,
    REMINDERS_RETRY_DELAY_MINUTES: 15,
    REMINDERS_PROCESSING_STALE_MINUTES: 10,
    ...overrides,
  };

  return {
    get: jest.fn((key: string, defaultValue?: unknown) =>
      key in values ? values[key] : defaultValue,
    ),
  };
}

function createReminderRepoMock(): MockRepo<BookingReminder> {
  return {
    find: jest.fn(),
    save: jest.fn(),
    create: jest.fn((input) => input),
    update: jest.fn(),
    createQueryBuilder: jest.fn(),
  };
}

function createBookingRepoMock(): MockRepo<Booking> {
  return {
    find: jest.fn(),
    save: jest.fn(),
    create: jest.fn((input) => input),
    update: jest.fn(),
    createQueryBuilder: jest.fn(),
  };
}

function createEmployee(overrides: Partial<Employee> = {}): Employee {
  return {
    id: 'employee-1',
    created_at: new Date('2026-03-10T10:00:00.000Z'),
    updated_at: new Date('2026-03-10T10:00:00.000Z'),
    tenant_id: 'tenant-1',
    tenant: undefined as never,
    name: 'Profesional Uno',
    email: 'pro@example.com',
    phone: null,
    phone_country_iso2: null,
    phone_national_number: null,
    phone_e164: null,
    avatar_url: null,
    avatar_key: null,
    schedule_timezone: 'America/Caracas',
    slot_interval_minutes: 15,
    is_active: true,
    services: [],
    ...overrides,
  };
}

function createBookingItem(overrides: Partial<BookingItem> = {}): BookingItem {
  return {
    id: 'item-1',
    created_at: new Date('2026-03-10T10:00:00.000Z'),
    updated_at: new Date('2026-03-10T10:00:00.000Z'),
    booking_id: 'booking-1',
    booking: undefined as never,
    service_id: 'service-1',
    service: {} as Service,
    service_name_snapshot: 'Corte',
    duration_minutes_snapshot: 30,
    buffer_before_minutes_snapshot: 5,
    buffer_after_minutes_snapshot: 5,
    price_snapshot: '10.00',
    currency_snapshot: 'USD',
    instructions_snapshot: null,
    sort_order: 0,
    ...overrides,
  };
}

function createBooking(overrides: Partial<Booking> = {}): Booking {
  const employee = createEmployee();
  return {
    id: 'booking-1',
    created_at: new Date('2026-03-18T15:00:00.000Z'),
    updated_at: new Date('2026-03-18T15:00:00.000Z'),
    tenant_id: 'tenant-1',
    employee_id: employee.id,
    employee,
    tenant: undefined as never,
    start_at_utc: new Date('2026-03-19T14:00:00.000Z'),
    end_at_utc: new Date('2026-03-19T15:00:00.000Z'),
    status: 'CONFIRMED',
    completed_at_utc: null,
    completed_by_user_id: null,
    cancelled_at_utc: null,
    cancelled_by_user_id: null,
    cancellation_reason: null,
    total_duration_minutes: 40,
    total_price: '10.00',
    currency: 'USD',
    customer_name: 'Cliente Uno',
    customer_email: 'cliente@example.com',
    customer_phone: null,
    customer_phone_country_iso2: null,
    customer_phone_national_number: null,
    customer_phone_e164: null,
    notes: null,
    source: 'WEB',
    created_by_user_id: null,
    created_by_user: null,
    items: [createBookingItem()],
    ...overrides,
  };
}

function createReminder(overrides: Partial<BookingReminder> = {}): BookingReminder {
  const booking = createBooking();
  return {
    id: 'reminder-1',
    created_at: new Date('2026-03-18T21:00:00.000Z'),
    updated_at: new Date('2026-03-18T21:00:00.000Z'),
    tenant_id: booking.tenant_id,
    booking_id: booking.id,
    booking,
    tenant: undefined as never,
    audience: 'CUSTOMER',
    channel: 'EMAIL',
    type: 'DAY_BEFORE_17H',
    status: 'PENDING',
    target_email: 'cliente@example.com',
    scheduled_for_utc: new Date('2026-03-18T21:00:00.000Z'),
    attempts_count: 0,
    last_attempt_at: null,
    next_attempt_at: null,
    processing_started_at: null,
    sent_at: null,
    last_error: null,
    ...overrides,
  };
}

describe('RemindersService', () => {
  let remindersRepository: MockRepo<BookingReminder>;
  let bookingsRepository: MockRepo<Booking>;
  let notificationsService: { sendBookingReminderNotification: jest.Mock };
  let service: RemindersService;

  beforeEach(() => {
    remindersRepository = createReminderRepoMock();
    bookingsRepository = createBookingRepoMock();
    notificationsService = {
      sendBookingReminderNotification: jest.fn(),
    };

    service = new RemindersService(
      remindersRepository as never,
      bookingsRepository as never,
      createConfigMock() as never,
      notificationsService as unknown as NotificationsService,
    );
  });

  it('schedules customer and employee reminders for a booking happening tomorrow', async () => {
    const booking = createBooking();
    jest
      .spyOn(service as any, 'loadBookingsForReminderWindow')
      .mockResolvedValue([booking] as any);
    remindersRepository.find.mockResolvedValue([]);
    remindersRepository.save.mockResolvedValue(undefined);

    const now = new Date('2026-03-18T21:00:00.000Z');
    const result = await service.dispatchTomorrowRemindersIfDue(now);

    expect(result.triggered).toBe(true);
    expect(result.kind).toBe('daily_dispatch');
    expect(result.booking_count).toBe(1);
    expect(result.candidate_count).toBe(2);
    expect(result.scheduled_count).toBe(2);
    expect(remindersRepository.save).toHaveBeenCalledTimes(2);
    expect(remindersRepository.save).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        booking_id: booking.id,
        audience: 'CUSTOMER',
        target_email: 'cliente@example.com',
      }),
    );
    expect(remindersRepository.save).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        booking_id: booking.id,
        audience: 'EMPLOYEE',
        target_email: 'pro@example.com',
      }),
    );
  });

  it('does not dispatch reminders before the configured 5pm cutoff', async () => {
    const loadBookingsSpy = jest.spyOn(
      service as any,
      'loadBookingsForReminderWindow',
    );

    const result = await service.dispatchTomorrowRemindersIfDue(
      new Date('2026-03-18T20:59:00.000Z'),
    );

    expect(result.triggered).toBe(false);
    expect(result.reason).toBe('not_due');
    expect(loadBookingsSpy).not.toHaveBeenCalled();
  });

  it('only schedules the employee reminder when the booking has no customer email', async () => {
    const booking = createBooking({
      customer_email: null,
    });
    jest
      .spyOn(service as any, 'loadBookingsForReminderWindow')
      .mockResolvedValue([booking] as any);
    remindersRepository.find.mockResolvedValue([]);
    remindersRepository.save.mockResolvedValue(undefined);

    const result = await service.dispatchTomorrowRemindersIfDue(
      new Date('2026-03-18T21:00:00.000Z'),
    );

    expect(result.scheduled_count).toBe(1);
    expect(result.skipped_missing_email_count).toBe(1);
    expect(remindersRepository.save).toHaveBeenCalledTimes(1);
    expect(remindersRepository.save).toHaveBeenCalledWith(
      expect.objectContaining({
        audience: 'EMPLOYEE',
        target_email: 'pro@example.com',
      }),
    );
  });

  it('does not duplicate reminders when the daily dispatch runs twice', async () => {
    const booking = createBooking();
    const storedReminders: BookingReminder[] = [];

    jest
      .spyOn(service as any, 'loadBookingsForReminderWindow')
      .mockResolvedValue([booking] as any);
    remindersRepository.find.mockImplementation(async () =>
      storedReminders.map((item) => ({
        booking_id: item.booking_id,
        audience: item.audience,
        type: item.type,
        channel: item.channel,
      })),
    );
    remindersRepository.save.mockImplementation(async (entity) => {
      storedReminders.push(entity);
      return entity;
    });

    const now = new Date('2026-03-18T21:00:00.000Z');
    await service.dispatchTomorrowRemindersIfDue(now);
    await service.dispatchTomorrowRemindersIfDue(now);

    expect(storedReminders).toHaveLength(2);
    expect(remindersRepository.save).toHaveBeenCalledTimes(2);
  });

  it('backfills reminders for tomorrow bookings created after the 5pm cutoff', async () => {
    const booking = createBooking({
      created_at: new Date('2026-03-18T23:10:00.000Z'),
    });
    jest
      .spyOn(service as any, 'loadBookingsForReminderWindow')
      .mockResolvedValue([booking] as any);
    remindersRepository.find.mockResolvedValue([]);
    remindersRepository.save.mockResolvedValue(undefined);

    const result = await service.backfillMissedTomorrowReminders(
      new Date('2026-03-18T23:30:00.000Z'),
    );

    expect(result.triggered).toBe(true);
    expect(result.kind).toBe('backfill');
    expect(result.scheduled_count).toBe(2);
    expect(remindersRepository.save).toHaveBeenCalledTimes(2);
  });

  it('marks a reminder as sent when processing succeeds', async () => {
    const reminder = createReminder();
    jest
      .spyOn(service as any, 'loadDueReminderCandidates')
      .mockResolvedValue([reminder] as any);
    jest
      .spyOn(service as any, 'tryClaimReminder')
      .mockResolvedValue(true as any);
    remindersRepository.update.mockResolvedValue({ affected: 1 });
    notificationsService.sendBookingReminderNotification.mockResolvedValue(undefined);

    const now = new Date('2026-03-18T21:00:00.000Z');
    const result = await service.processDueReminders(now);

    expect(result.claimed_count).toBe(1);
    expect(result.sent_count).toBe(1);
    expect(notificationsService.sendBookingReminderNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        reminderId: reminder.id,
        audience: 'CUSTOMER',
        recipient: expect.objectContaining({
          email: reminder.target_email,
        }),
      }),
    );
    expect(remindersRepository.update).toHaveBeenLastCalledWith(reminder.id, {
      status: 'SENT',
      processing_started_at: null,
      sent_at: now,
      next_attempt_at: null,
      last_error: null,
    });
  });

  it('skips a reminder when the booking was cancelled before delivery', async () => {
    const reminder = createReminder({
      booking: createBooking({
        status: 'CANCELLED',
      }),
    });
    jest
      .spyOn(service as any, 'loadDueReminderCandidates')
      .mockResolvedValue([reminder] as any);
    jest
      .spyOn(service as any, 'tryClaimReminder')
      .mockResolvedValue(true as any);
    remindersRepository.update.mockResolvedValue({ affected: 1 });

    const result = await service.processDueReminders(
      new Date('2026-03-18T21:00:00.000Z'),
    );

    expect(result.claimed_count).toBe(1);
    expect(result.skipped_count).toBe(1);
    expect(notificationsService.sendBookingReminderNotification).not.toHaveBeenCalled();
    expect(remindersRepository.update).toHaveBeenLastCalledWith(reminder.id, {
      status: 'SKIPPED',
      processing_started_at: null,
      next_attempt_at: null,
      last_error: 'Booking is no longer eligible for reminder delivery.',
    });
  });

  it('marks the reminder as failed and schedules a retry when email delivery throws', async () => {
    const reminder = createReminder();
    jest
      .spyOn(service as any, 'loadDueReminderCandidates')
      .mockResolvedValue([reminder] as any);
    jest
      .spyOn(service as any, 'tryClaimReminder')
      .mockResolvedValue(true as any);
    remindersRepository.update.mockResolvedValue({ affected: 1 });
    notificationsService.sendBookingReminderNotification.mockRejectedValue(
      new Error('Resend unavailable'),
    );

    const now = new Date('2026-03-18T21:00:00.000Z');
    const result = await service.processDueReminders(now);

    expect(result.failed_count).toBe(1);
    expect(remindersRepository.update).toHaveBeenLastCalledWith(reminder.id, {
      status: 'FAILED',
      processing_started_at: null,
      next_attempt_at: new Date('2026-03-18T21:15:00.000Z'),
      last_error: 'Error: Resend unavailable',
    });
  });
});
