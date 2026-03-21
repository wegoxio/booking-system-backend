import * as dotenv from 'dotenv';
dotenv.config();

import * as argon2 from 'argon2';
import { AppDataSource } from '../data-source';
import { Booking } from '../../bookings/entities/booking.entity';
import { BookingItem } from '../../bookings/entities/booking-item.entity';
import { BookingReminder } from '../../reminders/entities/booking-reminder.entity';
import { Employee } from '../../employees/entities/employee.entity';
import { Service } from '../../services/entity/service.entity';
import { Tenant } from '../../tenant/entities/tenant.entity';
import { User } from '../../users/entities/user.entity';
import type { BookingSource, BookingStatus } from '../../bookings/bookings.constants';

const SEED_MARKER = '[SEED_REPORTS_DEMO]';
const CURRENCY = 'USD';

const EMPLOYEE_PROFILES = [
  { name: 'Ana Páez', email: 'ana.paez@demo-wegox.com' },
  { name: 'Luis Herrera', email: 'luis.herrera@demo-wegox.com' },
  { name: 'Camila Torres', email: 'camila.torres@demo-wegox.com' },
  { name: 'David Márquez', email: 'david.marquez@demo-wegox.com' },
  { name: 'Rosa Silva', email: 'rosa.silva@demo-wegox.com' },
  { name: 'Nicolás Figueroa', email: 'nicolas.figueroa@demo-wegox.com' },
];

const SERVICE_PROFILES = [
  {
    name: 'Corte clásico',
    duration_minutes: 40,
    buffer_before_minutes: 5,
    buffer_after_minutes: 5,
    price: 18,
  },
  {
    name: 'Fade premium',
    duration_minutes: 55,
    buffer_before_minutes: 5,
    buffer_after_minutes: 10,
    price: 27,
  },
  {
    name: 'Arreglo de barba',
    duration_minutes: 30,
    buffer_before_minutes: 5,
    buffer_after_minutes: 5,
    price: 14,
  },
  {
    name: 'Afeitado tradicional',
    duration_minutes: 35,
    buffer_before_minutes: 5,
    buffer_after_minutes: 5,
    price: 16,
  },
  {
    name: 'Corte + barba',
    duration_minutes: 70,
    buffer_before_minutes: 10,
    buffer_after_minutes: 10,
    price: 34,
  },
  {
    name: 'Coloración masculina',
    duration_minutes: 90,
    buffer_before_minutes: 10,
    buffer_after_minutes: 10,
    price: 49,
  },
  {
    name: 'Lavado + estilizado',
    duration_minutes: 25,
    buffer_before_minutes: 5,
    buffer_after_minutes: 5,
    price: 12,
  },
  {
    name: 'Tratamiento capilar',
    duration_minutes: 50,
    buffer_before_minutes: 5,
    buffer_after_minutes: 10,
    price: 26,
  },
];

const CUSTOMER_FIRST_NAMES = [
  'Carlos',
  'Miguel',
  'José',
  'Andrés',
  'Luis',
  'Emilio',
  'Ricardo',
  'Gabriel',
  'Javier',
  'Sebastián',
  'Fernando',
  'Alejandro',
  'Daniel',
  'Mateo',
  'Tomás',
  'Héctor',
  'Diego',
  'Raúl',
  'Iván',
  'Samuel',
];

const CUSTOMER_LAST_NAMES = [
  'Pérez',
  'Ramírez',
  'Vargas',
  'Molina',
  'Castillo',
  'Rojas',
  'Suárez',
  'Díaz',
  'López',
  'Soto',
  'Núñez',
  'Quintero',
  'Cabrera',
  'Mendoza',
  'Guerrero',
  'Cordero',
  'Cortés',
  'Romero',
  'Ortega',
  'Salazar',
];

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomItem<T>(items: T[]): T {
  return items[randomInt(0, items.length - 1)];
}

function randomBoolean(probability = 0.5): boolean {
  return Math.random() < probability;
}

function randomWeightedValue<T>(input: Array<{ value: T; weight: number }>): T {
  const total = input.reduce((sum, item) => sum + item.weight, 0);
  const threshold = Math.random() * total;
  let cursor = 0;

  for (const item of input) {
    cursor += item.weight;
    if (threshold <= cursor) {
      return item.value;
    }
  }

  return input[input.length - 1].value;
}

function formatPrice(value: number): string {
  return value.toFixed(2);
}

function buildCustomerProfile(index: number): {
  name: string;
  email: string;
  phone: string;
  phone_country_iso2: string;
  phone_national_number: string;
  phone_e164: string;
} {
  const firstName = randomItem(CUSTOMER_FIRST_NAMES);
  const lastName = randomItem(CUSTOMER_LAST_NAMES);
  const normalizedFirstName = firstName
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  const normalizedLastName = lastName
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  const suffix = String(index + 1).padStart(4, '0');
  const nationalNumber = `412${String(randomInt(1000000, 9999999))}`;
  const e164 = `+58${nationalNumber}`;

  return {
    name: `${firstName} ${lastName}`,
    email: `${normalizedFirstName}.${normalizedLastName}.${suffix}@clientes-demo.com`,
    phone: e164,
    phone_country_iso2: 'VE',
    phone_national_number: nationalNumber,
    phone_e164: e164,
  };
}

function pickSource(): BookingSource {
  return randomWeightedValue<BookingSource>([
    { value: 'WEB', weight: 52 },
    { value: 'ADMIN', weight: 18 },
    { value: 'MANUAL', weight: 22 },
    { value: 'API', weight: 8 },
  ]);
}

function pickStatus(startAtUtc: Date): BookingStatus {
  const now = Date.now();
  const startsInFuture = startAtUtc.getTime() > now;

  if (startsInFuture) {
    return randomWeightedValue<BookingStatus>([
      { value: 'PENDING', weight: 32 },
      { value: 'CONFIRMED', weight: 45 },
      { value: 'IN_PROGRESS', weight: 5 },
      { value: 'CANCELLED', weight: 18 },
    ]);
  }

  return randomWeightedValue<BookingStatus>([
    { value: 'COMPLETED', weight: 63 },
    { value: 'CANCELLED', weight: 16 },
    { value: 'NO_SHOW', weight: 10 },
    { value: 'CONFIRMED', weight: 6 },
    { value: 'IN_PROGRESS', weight: 3 },
    { value: 'PENDING', weight: 2 },
  ]);
}

function buildBookingLifecycle(status: BookingStatus, startAtUtc: Date, endAtUtc: Date): {
  completed_at_utc: Date | null;
  completed_by_user_id: string | null;
  cancelled_at_utc: Date | null;
  cancelled_by_user_id: string | null;
  cancellation_reason: string | null;
} {
  if (status === 'COMPLETED') {
    return {
      completed_at_utc: new Date(Math.min(Date.now(), endAtUtc.getTime())),
      completed_by_user_id: null,
      cancelled_at_utc: null,
      cancelled_by_user_id: null,
      cancellation_reason: null,
    };
  }

  if (status === 'CANCELLED') {
    return {
      completed_at_utc: null,
      completed_by_user_id: null,
      cancelled_at_utc: new Date(Math.min(Date.now(), startAtUtc.getTime())),
      cancelled_by_user_id: null,
      cancellation_reason: randomItem([
        'Cliente reagendó',
        'Conflicto de horario del cliente',
        'Imprevisto operativo del local',
      ]),
    };
  }

  if (status === 'NO_SHOW') {
    return {
      completed_at_utc: null,
      completed_by_user_id: null,
      cancelled_at_utc: new Date(Math.min(Date.now(), endAtUtc.getTime())),
      cancelled_by_user_id: null,
      cancellation_reason: randomItem([
        'Cliente no se presentó',
        'No respondió confirmación',
      ]),
    };
  }

  return {
    completed_at_utc: null,
    completed_by_user_id: null,
    cancelled_at_utc: null,
    cancelled_by_user_id: null,
    cancellation_reason: null,
  };
}

function pickReminderStatus(): BookingReminder['status'] {
  return randomWeightedValue<BookingReminder['status']>([
    { value: 'SENT', weight: 72 },
    { value: 'FAILED', weight: 9 },
    { value: 'SKIPPED', weight: 7 },
    { value: 'PENDING', weight: 9 },
    { value: 'PROCESSING', weight: 3 },
  ]);
}

async function main() {
  const tenantName = process.env.DEMO_REPORTS_TENANT_NAME?.trim() || 'Barbería Demo Wegox';
  const tenantSlug = process.env.DEMO_REPORTS_TENANT_SLUG?.trim() || 'barberia-demo-wegox';
  const adminName = process.env.DEMO_REPORTS_ADMIN_NAME?.trim() || 'Wilfredo Demo';
  const adminEmail =
    process.env.DEMO_REPORTS_ADMIN_EMAIL?.trim().toLowerCase() ||
    'wilfredo.demo@barberia-demo-wegox.com';
  const adminPassword =
    process.env.DEMO_REPORTS_ADMIN_PASSWORD?.trim() || 'DemoReports123!';
  const bookingCount = Math.max(
    200,
    Number(process.env.DEMO_REPORTS_BOOKINGS_COUNT ?? 480),
  );

  await AppDataSource.initialize();

  const tenantRepo = AppDataSource.getRepository(Tenant);
  const usersRepo = AppDataSource.getRepository(User);
  const employeesRepo = AppDataSource.getRepository(Employee);
  const servicesRepo = AppDataSource.getRepository(Service);
  const bookingsRepo = AppDataSource.getRepository(Booking);
  const bookingItemsRepo = AppDataSource.getRepository(BookingItem);
  const remindersRepo = AppDataSource.getRepository(BookingReminder);

  const now = new Date();

  let tenant = await tenantRepo.findOne({ where: { slug: tenantSlug } });
  if (!tenant) {
    tenant = tenantRepo.create({
      name: tenantName,
      slug: tenantSlug,
      is_active: true,
    });
    tenant = await tenantRepo.save(tenant);
  } else {
    tenant.name = tenantName;
    tenant.is_active = true;
    tenant = await tenantRepo.save(tenant);
  }

  const passwordHash = await argon2.hash(adminPassword);
  let tenantAdmin = await usersRepo.findOne({ where: { email: adminEmail } });

  if (!tenantAdmin) {
    tenantAdmin = usersRepo.create({
      name: adminName,
      email: adminEmail,
      password_hash: passwordHash,
      role: 'TENANT_ADMIN',
      tenant_id: tenant.id,
      is_active: true,
      email_verified_at: now,
      invited_at: now,
      onboarding_completed_at: now,
      failed_login_attempts: 0,
      last_failed_login_at: null,
      locked_until: null,
      last_login_at: now,
      tenant_dashboard_tour_completed_at: null,
    });
  } else {
    tenantAdmin.name = adminName;
    tenantAdmin.password_hash = passwordHash;
    tenantAdmin.role = 'TENANT_ADMIN';
    tenantAdmin.tenant_id = tenant.id;
    tenantAdmin.is_active = true;
    tenantAdmin.email_verified_at = tenantAdmin.email_verified_at ?? now;
    tenantAdmin.invited_at = tenantAdmin.invited_at ?? now;
    tenantAdmin.onboarding_completed_at =
      tenantAdmin.onboarding_completed_at ?? now;
  }

  tenantAdmin = await usersRepo.save(tenantAdmin);

  const employees: Employee[] = [];
  for (const profile of EMPLOYEE_PROFILES) {
    let employee = await employeesRepo.findOne({
      where: {
        tenant_id: tenant.id,
        email: profile.email,
      },
    });

    if (!employee) {
      employee = employeesRepo.create({
        tenant_id: tenant.id,
        name: profile.name,
        email: profile.email,
        is_active: true,
        schedule_timezone: 'America/Caracas',
        slot_interval_minutes: 15,
      });
    } else {
      employee.name = profile.name;
      employee.is_active = true;
      employee.schedule_timezone = 'America/Caracas';
      employee.slot_interval_minutes = 15;
    }

    employee = await employeesRepo.save(employee);
    employees.push(employee);
  }

  const services: Service[] = [];
  for (const profile of SERVICE_PROFILES) {
    let service = await servicesRepo.findOne({
      where: {
        tenant_id: tenant.id,
        name: profile.name,
      },
      relations: { employees: true },
    });

    if (!service) {
      service = servicesRepo.create({
        tenant_id: tenant.id,
        name: profile.name,
        description: `Servicio profesional: ${profile.name}.`,
        instructions: randomBoolean(0.35)
          ? 'Llegar 10 minutos antes de la cita.'
          : null,
        duration_minutes: profile.duration_minutes,
        buffer_before_minutes: profile.buffer_before_minutes,
        buffer_after_minutes: profile.buffer_after_minutes,
        capacity: 1,
        price: formatPrice(profile.price),
        currency: CURRENCY,
        is_active: true,
        sort_order: services.length,
        requires_confirmation: randomBoolean(0.25),
        min_notice_minutes: randomItem([0, 30, 60, 90]),
        booking_window_days: randomItem([30, 45, 60, 90]),
        employees: [],
      });
    } else {
      service.description = `Servicio profesional: ${profile.name}.`;
      service.instructions = randomBoolean(0.35)
        ? 'Llegar 10 minutos antes de la cita.'
        : null;
      service.duration_minutes = profile.duration_minutes;
      service.buffer_before_minutes = profile.buffer_before_minutes;
      service.buffer_after_minutes = profile.buffer_after_minutes;
      service.capacity = 1;
      service.price = formatPrice(profile.price);
      service.currency = CURRENCY;
      service.is_active = true;
      service.requires_confirmation = randomBoolean(0.25);
      service.min_notice_minutes = randomItem([0, 30, 60, 90]);
      service.booking_window_days = randomItem([30, 45, 60, 90]);
    }

    const minimumEmployees = Math.min(2, employees.length);
    const maxEmployees = Math.min(4, employees.length);
    const assignedCount = randomInt(minimumEmployees, maxEmployees);
    const shuffled = [...employees].sort(() => Math.random() - 0.5);
    service.employees = shuffled.slice(0, assignedCount);

    service = await servicesRepo.save(service);
    services.push(service);
  }

  await bookingsRepo
    .createQueryBuilder()
    .delete()
    .where('tenant_id = :tenantId', { tenantId: tenant.id })
    .andWhere('notes LIKE :seedMarker', { seedMarker: `%${SEED_MARKER}%` })
    .execute();

  const nowUtc = new Date();
  const customerProfiles = Array.from({ length: 240 }, (_, index) =>
    buildCustomerProfile(index),
  );

  let createdBookings = 0;
  let createdItems = 0;
  let createdReminders = 0;

  for (let index = 0; index < bookingCount; index += 1) {
    const employee = randomItem(employees);
    const employeeServices = services.filter((service) =>
      service.employees.some((candidate) => candidate.id === employee.id),
    );

    if (employeeServices.length === 0) {
      continue;
    }

    const desiredServiceCount = randomInt(1, Math.min(3, employeeServices.length));
    const selectedServices = [...employeeServices]
      .sort(() => Math.random() - 0.5)
      .slice(0, desiredServiceCount);

    const dayOffset = randomInt(-120, 14);
    const startBase = new Date();
    startBase.setUTCHours(0, 0, 0, 0);
    startBase.setUTCDate(startBase.getUTCDate() + dayOffset);
    const hour = randomInt(8, 19);
    const minute = randomItem([0, 15, 30, 45]);
    const startAtUtc = new Date(startBase.getTime() + hour * 60 * 60 * 1000 + minute * 60 * 1000);

    const totalDurationMinutes = selectedServices.reduce(
      (sum, service) =>
        sum +
        service.duration_minutes +
        service.buffer_before_minutes +
        service.buffer_after_minutes,
      0,
    );
    const endAtUtc = new Date(startAtUtc.getTime() + totalDurationMinutes * 60 * 1000);

    const totalPrice = selectedServices.reduce(
      (sum, service) => sum + Number(service.price),
      0,
    );

    const status = pickStatus(startAtUtc);
    const source = pickSource();
    const customer = randomItem(customerProfiles);

    const leadTimeHours = randomInt(2, 24 * 18);
    const createdAtCandidate = new Date(startAtUtc.getTime() - leadTimeHours * 60 * 60 * 1000);
    const createdAt =
      createdAtCandidate.getTime() <= nowUtc.getTime()
        ? createdAtCandidate
        : new Date(nowUtc.getTime() - randomInt(10, 90) * 60 * 1000);

    const lifecycle = buildBookingLifecycle(status, startAtUtc, endAtUtc);
    const includeCustomerEmail = randomBoolean(0.86);
    const includeCustomerPhone = randomBoolean(0.9);

    let booking = bookingsRepo.create({
      tenant_id: tenant.id,
      employee_id: employee.id,
      start_at_utc: startAtUtc,
      end_at_utc: endAtUtc,
      status,
      completed_at_utc: lifecycle.completed_at_utc,
      completed_by_user_id: lifecycle.completed_by_user_id,
      cancelled_at_utc: lifecycle.cancelled_at_utc,
      cancelled_by_user_id: lifecycle.cancelled_by_user_id,
      cancellation_reason: lifecycle.cancellation_reason,
      total_duration_minutes: totalDurationMinutes,
      total_price: formatPrice(totalPrice),
      currency: CURRENCY,
      customer_name: customer.name,
      customer_email: includeCustomerEmail ? customer.email : null,
      customer_phone: includeCustomerPhone ? customer.phone : null,
      customer_phone_country_iso2: includeCustomerPhone
        ? customer.phone_country_iso2
        : null,
      customer_phone_national_number: includeCustomerPhone
        ? customer.phone_national_number
        : null,
      customer_phone_e164: includeCustomerPhone ? customer.phone_e164 : null,
      notes: `${SEED_MARKER} Booking demo #${index + 1}`,
      source,
      created_by_user_id: source === 'WEB' ? null : tenantAdmin.id,
      created_at: createdAt,
      updated_at: new Date(Math.max(createdAt.getTime(), nowUtc.getTime())),
      items: [],
    });

    booking = await bookingsRepo.save(booking);
    createdBookings += 1;

    const bookingItems = selectedServices.map((service, itemIndex) =>
      bookingItemsRepo.create({
        booking_id: booking.id,
        service_id: service.id,
        service_name_snapshot: service.name,
        duration_minutes_snapshot: service.duration_minutes,
        buffer_before_minutes_snapshot: service.buffer_before_minutes,
        buffer_after_minutes_snapshot: service.buffer_after_minutes,
        price_snapshot: formatPrice(Number(service.price)),
        currency_snapshot: service.currency,
        instructions_snapshot: service.instructions ?? null,
        sort_order: itemIndex,
        created_at: createdAt,
        updated_at: createdAt,
      }),
    );

    if (bookingItems.length > 0) {
      await bookingItemsRepo.save(bookingItems);
      createdItems += bookingItems.length;
    }

    const remindersToInsert: BookingReminder[] = [];
    const reminderScheduledForUtc = new Date(
      booking.start_at_utc.getTime() - 24 * 60 * 60 * 1000,
    );

    if (booking.customer_email) {
      const reminderStatus = pickReminderStatus();
      remindersToInsert.push(
        remindersRepo.create({
          tenant_id: tenant.id,
          booking_id: booking.id,
          audience: 'CUSTOMER',
          channel: 'EMAIL',
          type: 'DAY_BEFORE_17H',
          status: reminderStatus,
          target_email: booking.customer_email,
          scheduled_for_utc: reminderScheduledForUtc,
          attempts_count: reminderStatus === 'PENDING' ? 0 : randomInt(1, 3),
          last_attempt_at:
            reminderStatus === 'PENDING' ? null : new Date(reminderScheduledForUtc),
          next_attempt_at:
            reminderStatus === 'FAILED'
              ? new Date(reminderScheduledForUtc.getTime() + 15 * 60 * 1000)
              : null,
          processing_started_at:
            reminderStatus === 'PROCESSING'
              ? new Date(reminderScheduledForUtc)
              : null,
          sent_at:
            reminderStatus === 'SENT' ? new Date(reminderScheduledForUtc) : null,
          last_error:
            reminderStatus === 'FAILED'
              ? 'Error temporal de proveedor de correo'
              : reminderStatus === 'SKIPPED'
                ? 'Sin correo del destinatario al momento del envío'
                : null,
          created_at: createdAt,
          updated_at: createdAt,
        }),
      );
    }

    if (employee.email) {
      const reminderStatus = pickReminderStatus();
      remindersToInsert.push(
        remindersRepo.create({
          tenant_id: tenant.id,
          booking_id: booking.id,
          audience: 'EMPLOYEE',
          channel: 'EMAIL',
          type: 'DAY_BEFORE_17H',
          status: reminderStatus,
          target_email: employee.email,
          scheduled_for_utc: reminderScheduledForUtc,
          attempts_count: reminderStatus === 'PENDING' ? 0 : randomInt(1, 3),
          last_attempt_at:
            reminderStatus === 'PENDING' ? null : new Date(reminderScheduledForUtc),
          next_attempt_at:
            reminderStatus === 'FAILED'
              ? new Date(reminderScheduledForUtc.getTime() + 15 * 60 * 1000)
              : null,
          processing_started_at:
            reminderStatus === 'PROCESSING'
              ? new Date(reminderScheduledForUtc)
              : null,
          sent_at:
            reminderStatus === 'SENT' ? new Date(reminderScheduledForUtc) : null,
          last_error:
            reminderStatus === 'FAILED'
              ? 'Error temporal de proveedor de correo'
              : reminderStatus === 'SKIPPED'
                ? 'Sin correo del destinatario al momento del envío'
                : null,
          created_at: createdAt,
          updated_at: createdAt,
        }),
      );
    }

    if (remindersToInsert.length > 0) {
      await remindersRepo.save(remindersToInsert);
      createdReminders += remindersToInsert.length;
    }
  }

  console.log('✅ Seed de reportes completado');
  console.log(`   Tenant: ${tenant.name} (${tenant.slug})`);
  console.log(`   Tenant admin: ${tenantAdmin.email}`);
  console.log(`   Empleados activos: ${employees.length}`);
  console.log(`   Servicios activos: ${services.length}`);
  console.log(`   Bookings creados: ${createdBookings}`);
  console.log(`   Booking items creados: ${createdItems}`);
  console.log(`   Recordatorios creados: ${createdReminders}`);
  console.log(`   Password tenant admin: ${adminPassword}`);

  await AppDataSource.destroy();
}

main().catch(async (error) => {
  console.error('❌ Seed de reportes falló:', error);
  try {
    await AppDataSource.destroy();
  } catch {}
  process.exit(1);
});
