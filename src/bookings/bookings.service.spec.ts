import { ConflictException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { Employee } from '../employees/entities/employee.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { Service } from '../services/entity/service.entity';
import { Tenant } from '../tenant/entities/tenant.entity';
import { BookingsService } from './bookings.service';
import { Booking } from './entities/booking.entity';
import { BookingItem } from './entities/booking-item.entity';
import { EmployeeScheduleBreak } from './entities/employee-schedule-break.entity';
import { EmployeeScheduleRule } from './entities/employee-schedule-rule.entity';
import { EmployeeTimeOff } from './entities/employee-time-off.entity';

type MockRepo<T> = {
  findOne: jest.Mock;
  find: jest.Mock;
  save: jest.Mock;
  create: jest.Mock;
  update: jest.Mock;
  createQueryBuilder: jest.Mock;
};

function createRepoMock<T>(): MockRepo<T> {
  return {
    findOne: jest.fn(),
    find: jest.fn(),
    save: jest.fn(),
    create: jest.fn((input) => input),
    update: jest.fn(),
    createQueryBuilder: jest.fn(),
  };
}

function createService(overrides: Partial<Service> = {}): Service {
  return {
    id: 'service-1',
    created_at: new Date('2026-03-10T10:00:00.000Z'),
    updated_at: new Date('2026-03-10T10:00:00.000Z'),
    tenant_id: 'tenant-1',
    idempotency_key: null,
    tenant: undefined as never,
    name: 'Corte clasico',
    description: 'Servicio base',
    instructions: 'Llegar con el cabello limpio.',
    duration_minutes: 30,
    buffer_before_minutes: 5,
    buffer_after_minutes: 5,
    capacity: 1,
    min_capacity: 1,
    max_capacity: 1,
    min_party_size: 1,
    max_party_size: 1,
    slot_capacity: 1,
    pricing_model: 'FLAT',
    price: '15.00',
    currency: 'USD',
    is_active: true,
    sort_order: 0,
    requires_confirmation: false,
    min_notice_minutes: 0,
    booking_window_days: 60,
    employees: [],
    ...overrides,
  };
}

function createEmployee(
  service: Service,
  overrides: Partial<Employee> = {},
): Employee {
  return {
    id: 'employee-1',
    created_at: new Date('2026-03-10T10:00:00.000Z'),
    updated_at: new Date('2026-03-10T10:00:00.000Z'),
    tenant_id: 'tenant-1',
    tenant: undefined as never,
    name: 'Barbero Uno',
    email: 'barbero@example.com',
    phone: null,
    phone_country_iso2: null,
    phone_national_number: null,
    phone_e164: null,
    avatar_url: null,
    avatar_key: null,
    schedule_timezone: 'America/Caracas',
    slot_interval_minutes: 15,
    is_active: true,
    services: [service],
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
    service: undefined as never,
    service_name_snapshot: 'Corte clasico',
    duration_minutes_snapshot: 30,
    buffer_before_minutes_snapshot: 5,
    buffer_after_minutes_snapshot: 5,
    price_snapshot: '15.00',
    pricing_model_snapshot: 'FLAT',
    unit_price_snapshot: '15.00',
    quantity_snapshot: 1,
    line_total_snapshot: '15.00',
    currency_snapshot: 'USD',
    instructions_snapshot: 'Llegar con el cabello limpio.',
    sort_order: 0,
    ...overrides,
  };
}

function createBooking(
  employee: Employee,
  overrides: Partial<Booking> = {},
): Booking {
  return {
    id: 'booking-1',
    created_at: new Date('2026-03-18T10:00:00.000Z'),
    updated_at: new Date('2026-03-18T10:00:00.000Z'),
    tenant_id: 'tenant-1',
    employee_id: employee.id,
    employee,
    tenant: undefined as never,
    start_at_utc: new Date('2026-03-20T14:00:00.000Z'),
    end_at_utc: new Date('2026-03-20T14:40:00.000Z'),
    busy_start_at_utc: new Date('2026-03-20T13:55:00.000Z'),
    busy_end_at_utc: new Date('2026-03-20T14:35:00.000Z'),
    status: 'CONFIRMED',
    completed_at_utc: null,
    completed_by_user_id: null,
    cancelled_at_utc: null,
    cancelled_by_user_id: null,
    cancellation_reason: null,
    total_duration_minutes: 30,
    party_size: 1,
    total_price: '15.00',
    currency: 'USD',
    customer_name: 'Carlos',
    customer_email: 'carlos@example.com',
    customer_phone: null,
    customer_phone_country_iso2: null,
    customer_phone_national_number: null,
    customer_phone_e164: null,
    notes: null,
    source: 'MANUAL',
    created_by_user_id: 'user-1',
    created_by_user: null,
    items: [createBookingItem()],
    ...overrides,
  };
}

describe('BookingsService manual creation', () => {
  let bookingsRepository: MockRepo<Booking>;
  let scheduleRulesRepository: MockRepo<EmployeeScheduleRule>;
  let scheduleBreaksRepository: MockRepo<EmployeeScheduleBreak>;
  let employeeTimeOffRepository: MockRepo<EmployeeTimeOff>;
  let employeesRepository: MockRepo<Employee>;
  let servicesRepository: MockRepo<Service>;
  let tenantsRepository: MockRepo<Tenant>;
  let auditService: { log: jest.Mock };
  let notificationsService: { sendBookingLifecycleNotifications: jest.Mock };
  let service: BookingsService;

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-06-18T12:00:00.000Z'));
    bookingsRepository = createRepoMock<Booking>();
    scheduleRulesRepository = createRepoMock<EmployeeScheduleRule>();
    scheduleBreaksRepository = createRepoMock<EmployeeScheduleBreak>();
    employeeTimeOffRepository = createRepoMock<EmployeeTimeOff>();
    employeesRepository = createRepoMock<Employee>();
    servicesRepository = createRepoMock<Service>();
    tenantsRepository = createRepoMock<Tenant>();
    auditService = { log: jest.fn() };
    notificationsService = { sendBookingLifecycleNotifications: jest.fn() };
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  function buildService(dataSourceOverrides?: {
    transaction?: jest.Mock;
    overlappingBookings?: Booking[];
    serviceOverrides?: Partial<Service>;
  }): BookingsService {
    const serviceEntity = createService(dataSourceOverrides?.serviceOverrides);
    const employee = createEmployee(serviceEntity);
    let persistedBooking: Booking | null = null;

    servicesRepository.find.mockResolvedValue([serviceEntity]);
    employeesRepository.findOne.mockResolvedValue(employee);
    bookingsRepository.findOne.mockImplementation(async () =>
      persistedBooking
        ? ({
            ...persistedBooking,
            employee,
            items: persistedBooking.items,
          } as Booking)
        : createBooking(employee),
    );
    bookingsRepository.find.mockResolvedValue([]);
    scheduleRulesRepository.find.mockResolvedValue([
      {
        day_of_week: 5,
        start_time_local: '09:00',
        end_time_local: '18:00',
      },
    ]);
    scheduleBreaksRepository.find.mockResolvedValue([]);
    employeeTimeOffRepository.find.mockResolvedValue([]);

    const employeeManagerRepo = {
      createQueryBuilder: jest.fn(() => ({
        setLock: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(employee),
      })),
    };

    const bookingManagerRepo = {
      find: jest
        .fn()
        .mockResolvedValue(dataSourceOverrides?.overlappingBookings ?? []),
      create: jest.fn((input) => ({
        id: 'booking-1',
        created_at: new Date('2026-03-18T10:00:00.000Z'),
        updated_at: new Date('2026-03-18T10:00:00.000Z'),
        ...input,
      })),
      save: jest.fn(async (input) => {
        persistedBooking = input as Booking;
        return input;
      }),
    };

    const bookingItemManagerRepo = {
      create: jest.fn((input) => input),
    };

    const timeOffManagerRepo = {
      findOne: jest.fn().mockResolvedValue(null),
    };
    const serviceManagerRepo = {
      createQueryBuilder: jest.fn(() => ({
        setLock: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(serviceEntity),
      })),
    };

    const dataSource = {
      transaction:
        dataSourceOverrides?.transaction ??
        jest.fn(async (callback: (manager: any) => Promise<unknown>) =>
          callback({
            query: jest.fn().mockResolvedValue([]),
            getRepository: (entity: unknown) => {
              if (entity === Employee) return employeeManagerRepo;
              if (entity === Booking) return bookingManagerRepo;
              if (entity === BookingItem) return bookingItemManagerRepo;
              if (entity === EmployeeTimeOff) return timeOffManagerRepo;
              if (entity === Service) return serviceManagerRepo;
              throw new Error('Unexpected repository');
            },
          }),
        ),
    };

    return new BookingsService(
      bookingsRepository as never,
      scheduleRulesRepository as never,
      scheduleBreaksRepository as never,
      employeeTimeOffRepository as never,
      employeesRepository as never,
      servicesRepository as never,
      tenantsRepository as never,
      dataSource as never,
      auditService as unknown as AuditService,
      notificationsService as unknown as NotificationsService,
    );
  }

  it('creates a past manual booking as completed and snapshots service instructions', async () => {
    service = buildService();

    const result = await service.createManualBooking(
      {
        employee_id: 'employee-1',
        service_ids: ['service-1'],
        start_at_utc: '2026-03-15T14:00:00.000Z',
        customer_name: 'Carlos',
        customer_email: 'carlos@example.com',
      },
      {
        sub: 'user-1',
        role: 'TENANT_ADMIN',
        tenant_id: 'tenant-1',
      },
    );

    expect(result.status).toBe('COMPLETED');
    expect(result.items[0]?.instructions_snapshot).toBe(
      'Llegar con el cabello limpio.',
    );
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'BOOKING_MANUAL_CREATED',
      }),
    );
    expect(
      notificationsService.sendBookingLifecycleNotifications,
    ).not.toHaveBeenCalled();
  });

  it('calculates PER_PERSON totals and immutable pricing snapshots', async () => {
    service = buildService({
      serviceOverrides: {
        pricing_model: 'PER_PERSON',
        price: '18.50',
        max_party_size: 4,
        slot_capacity: 4,
        max_capacity: 4,
        capacity: 4,
      },
    });

    const result = await service.createManualBooking(
      {
        employee_id: 'employee-1',
        service_ids: ['service-1'],
        start_at_utc: '2026-03-19T14:00:00.000Z',
        party_size: 4,
        customer_name: 'Grupo',
      },
      { sub: 'user-1', role: 'TENANT_ADMIN', tenant_id: 'tenant-1' },
    );

    expect(result.total_price).toBe('74.00');
    expect(result.items[0]).toMatchObject({
      pricing_model_snapshot: 'PER_PERSON',
      unit_price_snapshot: '18.50',
      quantity_snapshot: 4,
      line_total_snapshot: '74.00',
    });
  });

  it('rejects a future manual booking that collides with active agenda when override is disabled', async () => {
    service = buildService({
      overlappingBookings: [
        createBooking(createEmployee(createService()), {
          start_at_utc: new Date('2026-03-20T14:10:00.000Z'),
          end_at_utc: new Date('2026-03-20T14:50:00.000Z'),
        }),
      ],
    });

    await expect(
      service.createManualBooking(
        {
          employee_id: 'employee-1',
          service_ids: ['service-1'],
          start_at_utc: '2026-03-20T14:00:00.000Z',
          customer_name: 'Carlos',
          status: 'CONFIRMED',
          allow_overlap: false,
        },
        {
          sub: 'user-1',
          role: 'TENANT_ADMIN',
          tenant_id: 'tenant-1',
        },
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('allows a future manual booking with overlap override enabled', async () => {
    service = buildService();
    bookingsRepository.find.mockResolvedValue([
      createBooking(createEmployee(createService()), {
        start_at_utc: new Date('2026-03-20T14:10:00.000Z'),
        end_at_utc: new Date('2026-03-20T14:50:00.000Z'),
      }),
    ]);

    const result = await service.createManualBooking(
      {
        employee_id: 'employee-1',
        service_ids: ['service-1'],
        start_at_utc: '2026-03-20T14:00:00.000Z',
        customer_name: 'Carlos',
        status: 'CONFIRMED',
        allow_overlap: true,
      },
      {
        sub: 'user-1',
        role: 'TENANT_ADMIN',
        tenant_id: 'tenant-1',
      },
    );

    expect(result.source).toBe('MANUAL');
    expect(auditService.log).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          allow_overlap: true,
        }),
      }),
    );
  });

  it('creates an availability booking as confirmed when the service does not require confirmation', async () => {
    service = buildService({
      serviceOverrides: {
        min_capacity: 1,
        max_capacity: 2,
        capacity: 2,
        max_party_size: 2,
        slot_capacity: 2,
      },
    });

    const result = await service.createBooking(
      {
        employee_id: 'employee-1',
        service_ids: ['service-1'],
        start_at_utc: '2026-06-19T13:35:00.000Z',
        party_size: 2,
        customer_name: 'Carlos',
        customer_email: 'carlos@example.com',
      },
      {
        sub: 'user-1',
        role: 'TENANT_ADMIN',
        tenant_id: 'tenant-1',
      },
    );

    expect(result.status).toBe('CONFIRMED');
    expect(result.party_size).toBe(2);
  });

  it('creates an availability booking as pending when the service requires confirmation', async () => {
    service = buildService({
      serviceOverrides: {
        requires_confirmation: true,
      },
    });

    const result = await service.createBooking(
      {
        employee_id: 'employee-1',
        service_ids: ['service-1'],
        start_at_utc: '2026-06-19T13:35:00.000Z',
        customer_name: 'Carlos',
      },
      {
        sub: 'user-1',
        role: 'TENANT_ADMIN',
        tenant_id: 'tenant-1',
      },
    );

    expect(result.status).toBe('PENDING');
  });

  it('allows same-service overlapping bookings until capacity is consumed', async () => {
    const serviceEntity = createService({
      min_capacity: 1,
      max_capacity: 2,
      capacity: 2,
      max_party_size: 2,
      slot_capacity: 2,
    });
    const employee = createEmployee(serviceEntity);
    service = buildService({
      serviceOverrides: {
        min_capacity: 1,
        max_capacity: 2,
        capacity: 2,
        max_party_size: 2,
        slot_capacity: 2,
      },
      overlappingBookings: [
        createBooking(employee, {
          start_at_utc: new Date('2026-06-19T13:35:00.000Z'),
          end_at_utc: new Date('2026-06-19T14:05:00.000Z'),
          busy_start_at_utc: new Date('2026-06-19T13:30:00.000Z'),
          busy_end_at_utc: new Date('2026-06-19T14:10:00.000Z'),
          party_size: 1,
          items: [createBookingItem({ service_id: 'service-1' })],
        }),
      ],
    });

    const result = await service.createBooking(
      {
        employee_id: 'employee-1',
        service_ids: ['service-1'],
        start_at_utc: '2026-06-19T13:35:00.000Z',
        party_size: 1,
        customer_name: 'Carlos',
      },
      {
        sub: 'user-1',
        role: 'TENANT_ADMIN',
        tenant_id: 'tenant-1',
      },
    );

    expect(result.status).toBe('CONFIRMED');
  });

  it('rejects same-service overlapping bookings when capacity is consumed', async () => {
    const serviceEntity = createService({
      min_capacity: 1,
      max_capacity: 2,
      capacity: 2,
      max_party_size: 2,
      slot_capacity: 2,
    });
    const employee = createEmployee(serviceEntity);
    service = buildService({
      serviceOverrides: {
        min_capacity: 1,
        max_capacity: 2,
        capacity: 2,
        max_party_size: 2,
        slot_capacity: 2,
      },
      overlappingBookings: [
        createBooking(employee, {
          start_at_utc: new Date('2026-06-19T13:40:00.000Z'),
          end_at_utc: new Date('2026-06-19T14:20:00.000Z'),
          party_size: 2,
          items: [createBookingItem({ service_id: 'service-1' })],
        }),
      ],
    });

    await expect(
      service.createBooking(
        {
          employee_id: 'employee-1',
          service_ids: ['service-1'],
          start_at_utc: '2026-06-19T13:40:00.000Z',
          party_size: 1,
          customer_name: 'Carlos',
        },
        {
          sub: 'user-1',
          role: 'TENANT_ADMIN',
          tenant_id: 'tenant-1',
        },
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('filters booking list by local date range for calendar views', async () => {
    service = buildService();

    const todayQb = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getCount: jest.fn().mockResolvedValue(0),
    };
    const rangeQb = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      clone: jest.fn(),
      select: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      offset: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      getCount: jest.fn().mockResolvedValue(0),
      getRawMany: jest.fn().mockResolvedValue([]),
    };
    const countCloneQb = {
      getCount: jest.fn().mockResolvedValue(0),
    };
    const pageCloneQb = {
      select: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      offset: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([]),
    };

    rangeQb.clone
      .mockReturnValueOnce(countCloneQb)
      .mockReturnValueOnce(pageCloneQb);
    bookingsRepository.createQueryBuilder
      .mockReturnValueOnce(todayQb)
      .mockReturnValueOnce(rangeQb);

    const result = await service.listBookings(
      {
        date_from: '2026-07-01',
        date_to: '2026-07-31',
        timezone: 'America/Caracas',
      },
      { sub: 'user-1', role: 'TENANT_ADMIN', tenant_id: 'tenant-1' },
    );

    expect(result.data).toEqual([]);
    expect(rangeQb.andWhere).toHaveBeenCalledWith(
      'booking.start_at_utc >= :dateFrom',
      expect.objectContaining({
        dateFrom: expect.any(Date),
      }),
    );
    expect(rangeQb.andWhere).toHaveBeenCalledWith(
      'booking.start_at_utc < :dateTo',
      expect.objectContaining({
        dateTo: expect.any(Date),
      }),
    );
  });
});
