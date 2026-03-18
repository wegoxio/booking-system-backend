import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { AuditService } from 'src/audit/audit.service';
import { normalizePhoneInput } from 'src/common/phone/phone.util';
import { Employee } from 'src/employees/entities/employee.entity';
import { NotificationsService } from 'src/notifications/notifications.service';
import { Service } from 'src/services/entity/service.entity';
import { Tenant } from 'src/tenant/entities/tenant.entity';
import { DataSource, In, LessThan, MoreThan, Repository } from 'typeorm';
import { Booking } from './entities/booking.entity';
import { BookingItem } from './entities/booking-item.entity';
import { EmployeeScheduleRule } from './entities/employee-schedule-rule.entity';
import { EmployeeScheduleBreak } from './entities/employee-schedule-break.entity';
import { EmployeeTimeOff } from './entities/employee-time-off.entity';
import { EligibleEmployeesQueryDto } from './dto/eligible-employees-query.dto';
import { AvailabilityQueryDto } from './dto/availability-query.dto';
import { SetEmployeeScheduleDto } from './dto/set-employee-schedule.dto';
import { CreateEmployeeTimeOffDto } from './dto/create-employee-time-off.dto';
import {
  addDaysToDateString,
  formatDateInTimeZone,
  generateSlots,
  getDayOfWeekFromDateString,
  getUtcRangeForLocalDate,
  hasOverlappingTimeRanges,
  parseTimeToMinutes,
  subtractIntervals,
  zonedDateTimeToUtc,
} from './bookings.time-utils';
import { CreateBookingDto } from './dto/create-booking.dto';
import {
  BOOKING_BLOCKING_STATUSES,
  BOOKING_CANCELLATION_STATUSES,
  BOOKING_STATUSES,
  BOOKING_STATUS_TRANSITIONS,
} from './bookings.constants';
import { ListBookingsQueryDto } from './dto/list-bookings-query.dto';
import { UpdateBookingStatusDto } from './dto/update-booking-status.dto';
import {
  PublicBookingConfirmation,
  PublicBookingEmployee,
  PublicBookingService,
} from './bookings-public.types';

type CurrentJwtUser = {
  sub: string;
  role: 'SUPER_ADMIN' | 'TENANT_ADMIN';
  tenant_id: string | null;
};

@Injectable()
export class BookingsService {
  constructor(
    @InjectRepository(Booking)
    private readonly bookingsRepository: Repository<Booking>,
    @InjectRepository(EmployeeScheduleRule)
    private readonly scheduleRulesRepository: Repository<EmployeeScheduleRule>,
    @InjectRepository(EmployeeScheduleBreak)
    private readonly scheduleBreaksRepository: Repository<EmployeeScheduleBreak>,
    @InjectRepository(EmployeeTimeOff)
    private readonly employeeTimeOffRepository: Repository<EmployeeTimeOff>,
    @InjectRepository(Employee)
    private readonly employeesRepository: Repository<Employee>,
    @InjectRepository(Service)
    private readonly servicesRepository: Repository<Service>,
    @InjectRepository(Tenant)
    private readonly tenantsRepository: Repository<Tenant>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async findEligibleEmployees(
    query: EligibleEmployeesQueryDto,
    currentUser: CurrentJwtUser,
  ): Promise<Employee[]> {
    const tenantId = this.requireTenantId(currentUser);
    return this.findEligibleEmployeesByTenantId(tenantId, query.service_ids);
  }

  async listPublicServicesByTenantSlug(
    tenantSlug: string,
  ): Promise<PublicBookingService[]> {
    const tenant = await this.findActiveTenantBySlug(tenantSlug);
    const services = await this.servicesRepository.find({
      where: {
        tenant_id: tenant.id,
        is_active: true,
      },
      relations: {
        employees: true,
      },
      order: {
        sort_order: 'ASC',
        created_at: 'DESC',
      },
    });

    const publicEmployeeWorkingDays = await this.buildPublicEmployeeWorkingDaysMap(
      tenant.id,
      services.flatMap((service) => service.employees.map((employee) => employee.id)),
    );

    return services
      .map((service) => {
        const eligibleEmployees = service.employees
          .filter((employee) => employee.is_active && employee.tenant_id === tenant.id)
          .map((employee) =>
            this.toPublicBookingEmployee(
              employee,
              publicEmployeeWorkingDays.get(employee.id),
            ),
          );

        if (eligibleEmployees.length === 0) {
          return null;
        }

        return {
          id: service.id,
          name: service.name,
          description: service.description,
          duration_minutes: service.duration_minutes,
          price: Number(service.price).toFixed(2),
          currency: service.currency,
          is_active: service.is_active,
          employees: eligibleEmployees,
        };
      })
      .filter((service): service is PublicBookingService => service !== null);
  }

  async findPublicEligibleEmployeesByTenantSlug(
    tenantSlug: string,
    query: EligibleEmployeesQueryDto,
  ): Promise<PublicBookingEmployee[]> {
    const tenant = await this.findActiveTenantBySlug(tenantSlug);
    const employees = await this.findEligibleEmployeesByTenantId(
      tenant.id,
      query.service_ids,
    );
    const publicEmployeeWorkingDays = await this.buildPublicEmployeeWorkingDaysMap(
      tenant.id,
      employees.map((employee) => employee.id),
    );

    return employees.map((employee) =>
      this.toPublicBookingEmployee(
        employee,
        publicEmployeeWorkingDays.get(employee.id),
      ),
    );
  }

  async setEmployeeSchedule(
    employeeId: string,
    dto: SetEmployeeScheduleDto,
    currentUser: CurrentJwtUser,
  ): Promise<{
    employee_id: string;
    schedule_timezone: string;
    slot_interval_minutes: number;
    working_hours: EmployeeScheduleRule[];
    breaks: EmployeeScheduleBreak[];
  }> {
    const tenantId = this.requireTenantId(currentUser);
    const employee = await this.findTenantEmployee(employeeId, tenantId);
    const existingWorkingHoursCount = await this.scheduleRulesRepository.count({
      where: {
        tenant_id: tenantId,
        employee_id: employee.id,
        is_active: true,
      },
    });
    const scheduleAction =
      existingWorkingHoursCount > 0
        ? 'EMPLOYEE_SCHEDULE_UPDATED'
        : 'EMPLOYEE_SCHEDULE_CREATED';

    const scheduleTimezone = dto.schedule_timezone?.trim() || employee.schedule_timezone || 'UTC';
    this.assertValidTimezone(scheduleTimezone);

    if (hasOverlappingTimeRanges(dto.working_hours)) {
      throw new BadRequestException('Working hours contain overlapping intervals');
    }

    if (dto.breaks && hasOverlappingTimeRanges(dto.breaks)) {
      throw new BadRequestException('Breaks contain overlapping intervals');
    }

    if (dto.breaks && dto.breaks.length > 0) {
      this.ensureBreaksInsideWorkingHours(dto.working_hours, dto.breaks);
    }

    await this.dataSource.transaction(async (manager) => {
      await manager.getRepository(Employee).update(
        { id: employee.id, tenant_id: tenantId },
        {
          schedule_timezone: scheduleTimezone,
        },
      );

      await manager.getRepository(EmployeeScheduleRule).delete({
        tenant_id: tenantId,
        employee_id: employee.id,
      });
      await manager.getRepository(EmployeeScheduleBreak).delete({
        tenant_id: tenantId,
        employee_id: employee.id,
      });

      const scheduleRules = dto.working_hours.map((interval) =>
        manager.getRepository(EmployeeScheduleRule).create({
          tenant_id: tenantId,
          employee_id: employee.id,
          day_of_week: interval.day_of_week,
          start_time_local: this.normalizeLocalTime(interval.start_time_local),
          end_time_local: this.normalizeLocalTime(interval.end_time_local),
          is_active: true,
        }),
      );

      if (scheduleRules.length > 0) {
        await manager.getRepository(EmployeeScheduleRule).save(scheduleRules);
      }

      const scheduleBreaks = (dto.breaks ?? []).map((interval) =>
        manager.getRepository(EmployeeScheduleBreak).create({
          tenant_id: tenantId,
          employee_id: employee.id,
          day_of_week: interval.day_of_week,
          start_time_local: this.normalizeLocalTime(interval.start_time_local),
          end_time_local: this.normalizeLocalTime(interval.end_time_local),
          is_active: true,
        }),
      );

      if (scheduleBreaks.length > 0) {
        await manager.getRepository(EmployeeScheduleBreak).save(scheduleBreaks);
      }
    });

    await this.auditService.log({
      actor_user_id: currentUser.sub,
      tenant_id: tenantId,
      action: scheduleAction,
      entity: 'employee',
      entity_id: employee.id,
      metadata: {
        schedule_timezone: scheduleTimezone,
        slot_interval_minutes: employee.slot_interval_minutes ?? 15,
        working_hours_count: dto.working_hours.length,
        breaks_count: dto.breaks?.length ?? 0,
      },
    });

    return this.getEmployeeSchedule(employee.id, currentUser);
  }

  async getEmployeeSchedule(
    employeeId: string,
    currentUser: CurrentJwtUser,
  ): Promise<{
    employee_id: string;
    schedule_timezone: string;
    slot_interval_minutes: number;
    working_hours: EmployeeScheduleRule[];
    breaks: EmployeeScheduleBreak[];
    active_time_off: EmployeeTimeOff[];
  }> {
    const tenantId = this.requireTenantId(currentUser);
    const employee = await this.findTenantEmployee(employeeId, tenantId);

    const [workingHours, breaks, activeTimeOff] = await Promise.all([
      this.scheduleRulesRepository.find({
        where: {
          tenant_id: tenantId,
          employee_id: employee.id,
          is_active: true,
        },
        order: {
          day_of_week: 'ASC',
          start_time_local: 'ASC',
        },
      }),
      this.scheduleBreaksRepository.find({
        where: {
          tenant_id: tenantId,
          employee_id: employee.id,
          is_active: true,
        },
        order: {
          day_of_week: 'ASC',
          start_time_local: 'ASC',
        },
      }),
      this.employeeTimeOffRepository.find({
        where: {
          tenant_id: tenantId,
          employee_id: employee.id,
          is_active: true,
          end_at_utc: MoreThan(new Date()),
        },
        order: {
          start_at_utc: 'ASC',
        },
      }),
    ]);

    return {
      employee_id: employee.id,
      schedule_timezone: employee.schedule_timezone || 'UTC',
      slot_interval_minutes: employee.slot_interval_minutes ?? 15,
      working_hours: workingHours,
      breaks,
      active_time_off: activeTimeOff,
    };
  }

  async createEmployeeTimeOff(
    employeeId: string,
    dto: CreateEmployeeTimeOffDto,
    currentUser: CurrentJwtUser,
  ): Promise<EmployeeTimeOff> {
    const tenantId = this.requireTenantId(currentUser);
    const employee = await this.findTenantEmployee(employeeId, tenantId);

    const startAt = new Date(dto.start_at_utc);
    const endAt = new Date(dto.end_at_utc);

    if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) {
      throw new BadRequestException('Invalid time-off range');
    }

    if (endAt.getTime() <= startAt.getTime()) {
      throw new BadRequestException('end_at_utc must be greater than start_at_utc');
    }

    const created = await this.employeeTimeOffRepository.save(
      this.employeeTimeOffRepository.create({
        tenant_id: tenantId,
        employee_id: employee.id,
        start_at_utc: startAt,
        end_at_utc: endAt,
        reason: dto.reason?.trim() ?? null,
        is_active: true,
      }),
    );

    await this.auditService.log({
      actor_user_id: currentUser.sub,
      tenant_id: tenantId,
      action: 'EMPLOYEE_TIME_OFF_CREATED',
      entity: 'employee',
      entity_id: employee.id,
      metadata: {
        time_off_id: created.id,
        start_at_utc: created.start_at_utc.toISOString(),
        end_at_utc: created.end_at_utc.toISOString(),
      },
    });

    return created;
  }

  async removeEmployeeTimeOff(
    employeeId: string,
    timeOffId: string,
    currentUser: CurrentJwtUser,
  ): Promise<{ id: string }> {
    const tenantId = this.requireTenantId(currentUser);
    const employee = await this.findTenantEmployee(employeeId, tenantId);

    const timeOff = await this.employeeTimeOffRepository.findOne({
      where: {
        id: timeOffId,
        tenant_id: tenantId,
        employee_id: employee.id,
      },
    });

    if (!timeOff) {
      throw new NotFoundException('Employee time off not found');
    }

    await this.employeeTimeOffRepository.remove(timeOff);

    await this.auditService.log({
      actor_user_id: currentUser.sub,
      tenant_id: tenantId,
      action: 'EMPLOYEE_TIME_OFF_REMOVED',
      entity: 'employee',
      entity_id: employee.id,
      metadata: {
        time_off_id: timeOff.id,
      },
    });

    return { id: timeOff.id };
  }

  async getAvailability(
    query: AvailabilityQueryDto,
    currentUser: CurrentJwtUser,
  ): Promise<{
    employee_id: string;
    date: string;
    timezone: string;
    slot_interval_minutes: number;
    required_duration_minutes: number;
    service_ids: string[];
    slots: Array<{ start_at_utc: string; end_at_utc: string }>;
  }> {
    const tenantId = this.requireTenantId(currentUser);
    return this.getAvailabilityByTenantId(tenantId, query);
  }

  async getPublicAvailabilityByTenantSlug(
    tenantSlug: string,
    query: AvailabilityQueryDto,
  ): Promise<{
    employee_id: string;
    date: string;
    timezone: string;
    slot_interval_minutes: number;
    required_duration_minutes: number;
    service_ids: string[];
    slots: Array<{ start_at_utc: string; end_at_utc: string }>;
  }> {
    const tenant = await this.findActiveTenantBySlug(tenantSlug);
    return this.getAvailabilityByTenantId(tenant.id, query);
  }

  async createPublicBookingByTenantSlug(
    tenantSlug: string,
    dto: CreateBookingDto,
  ): Promise<PublicBookingConfirmation> {
    const tenant = await this.findActiveTenantBySlug(tenantSlug);
    const booking = await this.createBookingForTenant(tenant.id, dto, null, 'WEB');
    return this.toPublicBookingConfirmation(booking);
  }

  async createBooking(
    dto: CreateBookingDto,
    currentUser: CurrentJwtUser,
  ): Promise<Booking> {
    const tenantId = this.requireTenantId(currentUser);
    return this.createBookingForTenant(
      tenantId,
      dto,
      currentUser.sub,
      dto.source ?? 'ADMIN',
    );
  }

  async listBookings(
    query: ListBookingsQueryDto,
    currentUser: CurrentJwtUser,
  ): Promise<Booking[]> {
    const tenantId = this.requireTenantId(currentUser);

    const qb = this.bookingsRepository
      .createQueryBuilder('booking')
      .leftJoinAndSelect('booking.employee', 'employee')
      .leftJoinAndSelect('booking.items', 'items')
      .where('booking.tenant_id = :tenantId', { tenantId });

    if (query.employee_id) {
      qb.andWhere('booking.employee_id = :employeeId', {
        employeeId: query.employee_id,
      });
    }

    if (query.status) {
      qb.andWhere('booking.status = :status', {
        status: query.status,
      });
    }

    if (query.date) {
      const start = new Date(`${query.date}T00:00:00.000Z`);
      const nextDate = addDaysToDateString(query.date, 1);
      const end = new Date(`${nextDate}T00:00:00.000Z`);

      qb.andWhere('booking.start_at_utc >= :start AND booking.start_at_utc < :end', {
        start,
        end,
      });
    }

    qb.orderBy('booking.start_at_utc', 'ASC').addOrderBy('items.sort_order', 'ASC');

    return qb.getMany();
  }

  async findOne(id: string, currentUser: CurrentJwtUser): Promise<Booking> {
    const tenantId = this.requireTenantId(currentUser);
    return this.findOneByTenantId(id, tenantId);
  }

  async updateStatus(
    id: string,
    dto: UpdateBookingStatusDto,
    currentUser: CurrentJwtUser,
  ): Promise<Booking> {
    const booking = await this.findOne(id, currentUser);
    const previousStatus = booking.status;
    const nextStatus = dto.status;
    const cancellationReason = dto.cancellation_reason?.trim() || null;
    const isCancellationStatus = this.isCancellationStatus(nextStatus);

    if (!BOOKING_STATUSES.includes(nextStatus)) {
      throw new BadRequestException('Invalid booking status');
    }

    if (booking.status === nextStatus) {
      return booking;
    }

    const allowedTransitions =
      BOOKING_STATUS_TRANSITIONS[
        previousStatus as keyof typeof BOOKING_STATUS_TRANSITIONS
      ];
    if (!allowedTransitions?.includes(nextStatus)) {
      throw new BadRequestException(
        `Cannot transition booking from ${previousStatus} to ${nextStatus}`,
      );
    }

    if (isCancellationStatus && !cancellationReason) {
      throw new BadRequestException(
        'Cancellation reason is required when cancelling or marking a booking as no-show',
      );
    }

    if (!isCancellationStatus && cancellationReason) {
      throw new BadRequestException(
        'Cancellation reason can only be provided for cancelled or no-show bookings',
      );
    }

    booking.status = nextStatus;

    if (nextStatus === 'COMPLETED') {
      booking.completed_at_utc = new Date();
      booking.completed_by_user_id = currentUser.sub;
      booking.cancelled_at_utc = null;
      booking.cancelled_by_user_id = null;
      booking.cancellation_reason = null;
    } else if (isCancellationStatus) {
      booking.cancelled_at_utc = new Date();
      booking.cancelled_by_user_id = currentUser.sub;
      booking.cancellation_reason = cancellationReason;
      booking.completed_at_utc = null;
      booking.completed_by_user_id = null;
    } else {
      booking.completed_at_utc = null;
      booking.completed_by_user_id = null;
      booking.cancelled_at_utc = null;
      booking.cancelled_by_user_id = null;
      booking.cancellation_reason = null;
    }

    const updated = await this.bookingsRepository.save(booking);

    await this.auditService.log({
      actor_user_id: currentUser.sub,
      tenant_id: booking.tenant_id,
      action: 'BOOKING_STATUS_UPDATED',
      entity: 'booking',
      entity_id: booking.id,
      metadata: {
        previous_status: previousStatus,
        status: updated.status,
        cancellation_reason: updated.cancellation_reason,
      },
    });

    const hydratedBooking = await this.findOneByTenantId(updated.id, booking.tenant_id);

    if (nextStatus === 'COMPLETED') {
      void this.notificationsService.sendBookingLifecycleNotifications(
        hydratedBooking,
        'BOOKING_COMPLETED',
      );
    } else if (isCancellationStatus) {
      void this.notificationsService.sendBookingLifecycleNotifications(
        hydratedBooking,
        'BOOKING_CANCELLED',
      );
    }

    return hydratedBooking;
  }

  private async createBookingForTenant(
    tenantId: string,
    dto: CreateBookingDto,
    actorUserId: string | null,
    bookingSource: string,
  ): Promise<Booking> {
    const serviceIds = this.uniqueIds(dto.service_ids);
    const selectedServices = await this.resolveActiveServices(tenantId, serviceIds);
    const employee = await this.findTenantEmployee(dto.employee_id, tenantId, true);
    this.assertEmployeeOffersAllServices(employee, serviceIds);

    const startAt = new Date(dto.start_at_utc);
    if (Number.isNaN(startAt.getTime())) {
      throw new BadRequestException('Invalid booking start_at_utc');
    }

    const timezone = employee.schedule_timezone || 'UTC';
    this.assertValidTimezone(timezone);
    const localDate = formatDateInTimeZone(startAt, timezone);

    const availability = await this.computeAvailability({
      tenantId,
      employeeId: employee.id,
      serviceIds,
      date: localDate,
      timezone,
    });

    const matchedSlot = availability.slots.find(
      (slot) => slot.start_at_utc.getTime() === startAt.getTime(),
    );
    if (!matchedSlot) {
      throw new ConflictException('Selected slot is not available');
    }

    const totalDurationMinutes = this.getTotalDurationMinutes(selectedServices);
    const totalPrice = this.getTotalPrice(selectedServices);
    const currency = selectedServices[0]?.currency ?? 'USD';

    const servicesById = new Map(selectedServices.map((service) => [service.id, service]));
    const orderedServices = serviceIds.map((serviceId) => servicesById.get(serviceId)!);
    const normalizedCustomerPhone = normalizePhoneInput({
      countryIso2: dto.customer_phone_country_iso2,
      nationalNumber: dto.customer_phone_national_number,
      legacyPhone: dto.customer_phone,
      fieldLabel: 'customer phone',
    });

    const booking = await this.dataSource.transaction(async (manager) => {
      const employeeLocked = await manager
        .getRepository(Employee)
        .createQueryBuilder('employee')
        .setLock('pessimistic_write')
        .where('employee.id = :employeeId', { employeeId: employee.id })
        .andWhere('employee.tenant_id = :tenantId', { tenantId })
        .getOne();

      if (!employeeLocked || !employeeLocked.is_active) {
        throw new BadRequestException('Employee is inactive or not available');
      }

      const overlapping = await manager.getRepository(Booking).findOne({
        where: {
          tenant_id: tenantId,
          employee_id: employee.id,
          status: In([...BOOKING_BLOCKING_STATUSES]),
          start_at_utc: LessThan(matchedSlot.end_at_utc),
          end_at_utc: MoreThan(matchedSlot.start_at_utc),
        },
      });

      if (overlapping) {
        throw new ConflictException('Selected slot is no longer available');
      }

      const created = manager.getRepository(Booking).create({
        tenant_id: tenantId,
        employee_id: employee.id,
        start_at_utc: matchedSlot.start_at_utc,
        end_at_utc: matchedSlot.end_at_utc,
        status: 'PENDING',
        total_duration_minutes: totalDurationMinutes,
        total_price: totalPrice.toFixed(2),
        currency,
        customer_name: dto.customer_name.trim(),
        customer_email: dto.customer_email?.trim().toLowerCase() ?? null,
        customer_phone: normalizedCustomerPhone.display,
        customer_phone_country_iso2: normalizedCustomerPhone.countryIso2,
        customer_phone_national_number: normalizedCustomerPhone.nationalNumber,
        customer_phone_e164: normalizedCustomerPhone.e164,
        notes: dto.notes?.trim() ?? null,
        source: bookingSource,
        created_by_user_id: actorUserId,
        items: orderedServices.map((service, index) =>
          manager.getRepository(BookingItem).create({
            service_id: service.id,
            service_name_snapshot: service.name,
            duration_minutes_snapshot: service.duration_minutes,
            buffer_before_minutes_snapshot: service.buffer_before_minutes,
            buffer_after_minutes_snapshot: service.buffer_after_minutes,
            price_snapshot: Number(service.price).toFixed(2),
            currency_snapshot: service.currency,
            sort_order: index,
          }),
        ),
      });

      return manager.getRepository(Booking).save(created);
    });

    if (actorUserId) {
      await this.auditService.log({
        actor_user_id: actorUserId,
        tenant_id: tenantId,
        action: 'BOOKING_CREATED',
        entity: 'booking',
        entity_id: booking.id,
        metadata: {
          employee_id: booking.employee_id,
          service_ids: serviceIds,
          start_at_utc: booking.start_at_utc.toISOString(),
          end_at_utc: booking.end_at_utc.toISOString(),
          status: booking.status,
          source: booking.source,
        },
      });
    }

    const hydratedBooking = await this.findOneByTenantId(booking.id, tenantId);

    void this.notificationsService.sendBookingLifecycleNotifications(
      hydratedBooking,
      'BOOKING_CREATED',
    );

    return hydratedBooking;
  }

  private async computeAvailability(input: {
    tenantId: string;
    employeeId: string;
    serviceIds: string[];
    date: string;
    timezone?: string;
  }): Promise<{
    employee_id: string;
    date: string;
    timezone: string;
    slot_interval_minutes: number;
    required_duration_minutes: number;
    service_ids: string[];
    slots: Array<{ start_at_utc: Date; end_at_utc: Date }>;
  }> {
    const serviceIds = this.uniqueIds(input.serviceIds);
    const selectedServices = await this.resolveActiveServices(input.tenantId, serviceIds);
    const employee = await this.findTenantEmployee(input.employeeId, input.tenantId, true);
    this.assertEmployeeOffersAllServices(employee, serviceIds);

    const timezone = input.timezone?.trim() || employee.schedule_timezone || 'UTC';
    this.assertValidTimezone(timezone);

    const dayOfWeek = getDayOfWeekFromDateString(input.date);
    const [rules, breaks] = await Promise.all([
      this.scheduleRulesRepository.find({
        where: {
          tenant_id: input.tenantId,
          employee_id: employee.id,
          day_of_week: dayOfWeek,
          is_active: true,
        },
        order: { start_time_local: 'ASC' },
      }),
      this.scheduleBreaksRepository.find({
        where: {
          tenant_id: input.tenantId,
          employee_id: employee.id,
          day_of_week: dayOfWeek,
          is_active: true,
        },
        order: { start_time_local: 'ASC' },
      }),
    ]);

    const totalDurationMinutes = this.getTotalDurationMinutes(selectedServices);
    // Slots are generated from requested service duration, not from per-employee configuration.
    const slotIntervalMinutes = Math.max(totalDurationMinutes, 5);

    if (rules.length === 0) {
      return {
        employee_id: employee.id,
        date: input.date,
        timezone,
        slot_interval_minutes: slotIntervalMinutes,
        required_duration_minutes: totalDurationMinutes,
        service_ids: serviceIds,
        slots: [],
      };
    }

    const workIntervals = rules.map((rule) => ({
      start: zonedDateTimeToUtc(
        input.date,
        this.normalizeLocalTime(rule.start_time_local),
        timezone,
      ),
      end: zonedDateTimeToUtc(
        input.date,
        this.normalizeLocalTime(rule.end_time_local),
        timezone,
      ),
    }));

    const breakIntervals = breaks.map((brk) => ({
      start: zonedDateTimeToUtc(
        input.date,
        this.normalizeLocalTime(brk.start_time_local),
        timezone,
      ),
      end: zonedDateTimeToUtc(
        input.date,
        this.normalizeLocalTime(brk.end_time_local),
        timezone,
      ),
    }));

    const dayRange = getUtcRangeForLocalDate(input.date, timezone);

    const [timeOff, activeBookings] = await Promise.all([
      this.employeeTimeOffRepository.find({
        where: {
          tenant_id: input.tenantId,
          employee_id: employee.id,
          is_active: true,
          start_at_utc: LessThan(dayRange.end),
          end_at_utc: MoreThan(dayRange.start),
        },
      }),
      this.bookingsRepository.find({
        where: {
          tenant_id: input.tenantId,
          employee_id: employee.id,
          status: In([...BOOKING_BLOCKING_STATUSES]),
          start_at_utc: LessThan(dayRange.end),
          end_at_utc: MoreThan(dayRange.start),
        },
      }),
    ]);

    const busyIntervals = [
      ...breakIntervals,
      ...timeOff.map((item) => ({
        start: item.start_at_utc,
        end: item.end_at_utc,
      })),
      ...activeBookings.map((item) => ({
        start: item.start_at_utc,
        end: item.end_at_utc,
      })),
    ];

    const freeIntervals = subtractIntervals(workIntervals, busyIntervals);
    const rawSlots = generateSlots(
      freeIntervals,
      slotIntervalMinutes,
      totalDurationMinutes,
    );

    const minNoticeMinutes = selectedServices.reduce(
      (maxNotice, service) => Math.max(maxNotice, service.min_notice_minutes),
      0,
    );
    const maxBookingWindowDays = selectedServices.reduce(
      (minWindow, service) => Math.min(minWindow, service.booking_window_days),
      365,
    );

    const now = new Date();
    const earliestAllowed = new Date(now.getTime() + minNoticeMinutes * 60 * 1000);
    const latestAllowed = new Date(
      now.getTime() + maxBookingWindowDays * 24 * 60 * 60 * 1000,
    );

    const slots = rawSlots.filter(
      (slot) =>
        slot.start_at_utc.getTime() >= earliestAllowed.getTime() &&
        slot.start_at_utc.getTime() <= latestAllowed.getTime(),
    );

    return {
      employee_id: employee.id,
      date: input.date,
      timezone,
      slot_interval_minutes: slotIntervalMinutes,
      required_duration_minutes: totalDurationMinutes,
      service_ids: serviceIds,
      slots,
    };
  }

  private async getAvailabilityByTenantId(
    tenantId: string,
    query: AvailabilityQueryDto,
  ): Promise<{
    employee_id: string;
    date: string;
    timezone: string;
    slot_interval_minutes: number;
    required_duration_minutes: number;
    service_ids: string[];
    slots: Array<{ start_at_utc: string; end_at_utc: string }>;
  }> {
    const availability = await this.computeAvailability({
      tenantId,
      employeeId: query.employee_id,
      serviceIds: query.service_ids,
      date: query.date,
      timezone: query.timezone,
    });

    return {
      employee_id: availability.employee_id,
      date: availability.date,
      timezone: availability.timezone,
      slot_interval_minutes: availability.slot_interval_minutes,
      required_duration_minutes: availability.required_duration_minutes,
      service_ids: availability.service_ids,
      slots: availability.slots.map((slot) => ({
        start_at_utc: slot.start_at_utc.toISOString(),
        end_at_utc: slot.end_at_utc.toISOString(),
      })),
    };
  }

  private async findEligibleEmployeesByTenantId(
    tenantId: string,
    serviceIdsInput: string[],
  ): Promise<Employee[]> {
    const serviceIds = this.uniqueIds(serviceIdsInput);

    await this.resolveActiveServices(tenantId, serviceIds);

    const rawEligible = await this.employeesRepository
      .createQueryBuilder('employee')
      .innerJoin(
        'employee.services',
        'service',
        'service.id IN (:...serviceIds) AND service.is_active = true',
        { serviceIds },
      )
      .where('employee.tenant_id = :tenantId', { tenantId })
      .andWhere('employee.is_active = true')
      .select('employee.id', 'id')
      .groupBy('employee.id')
      .having('COUNT(DISTINCT service.id) = :serviceCount', {
        serviceCount: serviceIds.length,
      })
      .getRawMany<{ id: string }>();

    const eligibleIds = rawEligible.map((row) => row.id);
    if (eligibleIds.length === 0) return [];

    return this.employeesRepository.find({
      where: {
        tenant_id: tenantId,
        id: In(eligibleIds),
      },
      order: {
        name: 'ASC',
      },
    });
  }

  private requireTenantId(currentUser: CurrentJwtUser): string {
    if (!currentUser.tenant_id) {
      throw new BadRequestException('Tenant context is required');
    }
    return currentUser.tenant_id;
  }

  private async findOneByTenantId(id: string, tenantId: string): Promise<Booking> {
    const booking = await this.bookingsRepository.findOne({
      where: {
        id,
        tenant_id: tenantId,
      },
      relations: {
        employee: true,
        items: true,
      },
    });

    if (!booking) {
      throw new NotFoundException('Booking not found');
    }

    return booking;
  }

  private async findActiveTenantBySlug(tenantSlug: string): Promise<Tenant> {
    const normalizedSlug = tenantSlug.trim().toLowerCase();
    if (!normalizedSlug) {
      throw new BadRequestException('Tenant slug is required');
    }

    const tenant = await this.tenantsRepository.findOne({
      where: { slug: normalizedSlug },
    });

    if (!tenant || !tenant.is_active) {
      throw new NotFoundException('Business not found');
    }

    return tenant;
  }

  private async findTenantEmployee(
    employeeId: string,
    tenantId: string,
    withServices = false,
  ): Promise<Employee> {
    const employee = await this.employeesRepository.findOne({
      where: {
        id: employeeId,
        tenant_id: tenantId,
      },
      relations: withServices ? { services: true } : undefined,
    });

    if (!employee) {
      throw new NotFoundException('Employee not found');
    }

    return employee;
  }

  private async resolveActiveServices(
    tenantId: string,
    serviceIds: string[],
  ): Promise<Service[]> {
    const uniqueServiceIds = this.uniqueIds(serviceIds);
    if (uniqueServiceIds.length === 0) {
      throw new BadRequestException('At least one service is required');
    }

    const services = await this.servicesRepository.find({
      where: {
        tenant_id: tenantId,
        id: In(uniqueServiceIds),
        is_active: true,
      },
      relations: { employees: false },
    });

    if (services.length !== uniqueServiceIds.length) {
      throw new BadRequestException(
        'Some services are invalid, inactive, or outside tenant scope',
      );
    }

    const map = new Map(services.map((service) => [service.id, service]));
    return uniqueServiceIds.map((id) => map.get(id)!);
  }

  private assertEmployeeOffersAllServices(
    employee: Employee & { services?: Service[] },
    serviceIds: string[],
  ): void {
    const offeredIds = new Set((employee.services ?? []).map((service) => service.id));
    const missing = serviceIds.filter((serviceId) => !offeredIds.has(serviceId));

    if (missing.length > 0) {
      throw new BadRequestException(
        'Selected employee does not provide all requested services',
      );
    }
  }

  private assertValidTimezone(timezone: string): void {
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format(new Date());
    } catch {
      throw new BadRequestException('Invalid schedule timezone');
    }
  }

  private ensureBreaksInsideWorkingHours(
    workingHours: Array<{
      day_of_week: number;
      start_time_local: string;
      end_time_local: string;
    }>,
    breaks: Array<{
      day_of_week: number;
      start_time_local: string;
      end_time_local: string;
    }>,
  ): void {
    for (const pause of breaks) {
      const breakStart = parseTimeToMinutes(pause.start_time_local);
      const breakEnd = parseTimeToMinutes(pause.end_time_local);

      const insideWorkBlock = workingHours.some((work) => {
        if (work.day_of_week !== pause.day_of_week) return false;
        const workStart = parseTimeToMinutes(work.start_time_local);
        const workEnd = parseTimeToMinutes(work.end_time_local);
        return breakStart >= workStart && breakEnd <= workEnd;
      });

      if (!insideWorkBlock) {
        throw new BadRequestException(
          'Each break must be fully contained within a working-hour interval',
        );
      }
    }
  }

  private uniqueIds(ids: string[]): string[] {
    return Array.from(new Set(ids));
  }

  private getTotalDurationMinutes(services: Service[]): number {
    return services.reduce(
      (total, service) =>
        total +
        service.duration_minutes +
        service.buffer_before_minutes +
        service.buffer_after_minutes,
      0,
    );
  }

  private getTotalPrice(services: Service[]): number {
    return services.reduce((sum, service) => sum + Number(service.price), 0);
  }

  private normalizeLocalTime(value: string): string {
    return value.trim().slice(0, 5);
  }

  private isCancellationStatus(status: string): status is 'CANCELLED' | 'NO_SHOW' {
    return (BOOKING_CANCELLATION_STATUSES as readonly string[]).includes(status);
  }

  private toPublicBookingEmployee(
    employee: Employee,
    workingDays?: number[],
  ): PublicBookingEmployee {
    return {
      id: employee.id,
      name: employee.name,
      working_days: [...new Set(workingDays ?? [])].sort((a, b) => a - b),
    };
  }

  private async buildPublicEmployeeWorkingDaysMap(
    tenantId: string,
    employeeIds: string[],
  ): Promise<Map<string, number[]>> {
    const uniqueEmployeeIds = this.uniqueIds(employeeIds);
    const result = new Map<string, number[]>();

    if (uniqueEmployeeIds.length === 0) {
      return result;
    }

    const rules = await this.scheduleRulesRepository.find({
      where: {
        tenant_id: tenantId,
        employee_id: In(uniqueEmployeeIds),
        is_active: true,
      },
      select: {
        employee_id: true,
        day_of_week: true,
      },
      order: {
        employee_id: 'ASC',
        day_of_week: 'ASC',
      },
    });

    for (const employeeId of uniqueEmployeeIds) {
      result.set(employeeId, []);
    }

    for (const rule of rules) {
      const existingDays = result.get(rule.employee_id) ?? [];
      if (!existingDays.includes(rule.day_of_week)) {
        existingDays.push(rule.day_of_week);
        result.set(rule.employee_id, existingDays);
      }
    }

    return result;
  }

  private toPublicBookingConfirmation(booking: Booking): PublicBookingConfirmation {
    return {
      id: booking.id,
      status: booking.status,
      start_at_utc: booking.start_at_utc.toISOString(),
      end_at_utc: booking.end_at_utc.toISOString(),
      total_duration_minutes: booking.total_duration_minutes,
      total_price: Number(booking.total_price).toFixed(2),
      currency: booking.currency,
      customer_name: booking.customer_name,
      employee: booking.employee
        ? this.toPublicBookingEmployee(booking.employee)
        : null,
      items: booking.items.map((item) => ({
        id: item.id,
        service_id: item.service_id,
        service_name_snapshot: item.service_name_snapshot,
        duration_minutes_snapshot: item.duration_minutes_snapshot,
        price_snapshot: Number(item.price_snapshot).toFixed(2),
        currency_snapshot: item.currency_snapshot,
        sort_order: item.sort_order,
      })),
    };
  }
}
