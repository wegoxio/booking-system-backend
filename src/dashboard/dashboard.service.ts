import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { resolveAuditMessage } from '../audit/audit-message.utils';
import { AuditLog } from '../audit/entities/audit-log.entity';
import {
  BOOKING_CANCELLATION_STATUSES,
  BOOKING_REVENUE_STATUSES,
} from '../bookings/bookings.constants';
import { Booking } from '../bookings/entities/booking.entity';
import { Employee } from '../employees/entities/employee.entity';
import { Service } from '../services/entity/service.entity';
import { Tenant } from '../tenant/entities/tenant.entity';
import { TenantSetting } from '../tenant-settings/entities/tenant-setting.entity';
import { User } from '../users/entities/user.entity';
import { Repository } from 'typeorm';
import { DashboardOverviewQueryDto } from './dto/dashboard-overview-query.dto';
import type { CurrentJwtUser } from '../auth/types';
import { DashboardChartPoint, DashboardEmployeeTableRow, DashboardOverviewResponse, DashboardRecentLog, DashboardTenantTableRow, PeriodSummary } from './types';


@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Tenant)
    private readonly tenantRepository: Repository<Tenant>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @InjectRepository(TenantSetting)
    private readonly tenantSettingsRepository: Repository<TenantSetting>,
    @InjectRepository(Booking)
    private readonly bookingsRepository: Repository<Booking>,
    @InjectRepository(Employee)
    private readonly employeesRepository: Repository<Employee>,
    @InjectRepository(Service)
    private readonly servicesRepository: Repository<Service>,
    @InjectRepository(AuditLog)
    private readonly auditLogsRepository: Repository<AuditLog>,
  ) {}

  async getOverview(
    currentUser: CurrentJwtUser,
    query: DashboardOverviewQueryDto,
  ): Promise<DashboardOverviewResponse> {
    const months = this.normalizeMonths(query.months);
    const logsLimit = this.normalizeLogsLimit(query.logs_limit);
    const tableLimit = this.normalizeTableLimit(query.table_limit);

    if (currentUser.role === 'SUPER_ADMIN') {
      return this.buildSuperAdminOverview({
        currentUser,
        months,
        logsLimit,
        tableLimit,
      });
    }

    return this.buildTenantAdminOverview({
      currentUser,
      months,
      logsLimit,
      tableLimit,
    });
  }

  private async buildSuperAdminOverview(input: {
    currentUser: CurrentJwtUser;
    months: number;
    logsLimit: number;
    tableLimit: number;
  }): Promise<DashboardOverviewResponse> {
    const currentMonthStart = this.getUtcMonthStart(new Date());
    const nextMonthStart = this.addUtcMonths(currentMonthStart, 1);
    const previousMonthStart = this.addUtcMonths(currentMonthStart, -1);

    const [
      totalTenants,
      activeTenants,
      totalTenantAdmins,
      currentSummary,
      previousSummary,
      chart,
      recentLogs,
      tenantsTable,
    ] = await Promise.all([
      this.tenantRepository.count(),
      this.tenantRepository.count({ where: { is_active: true } }),
      this.usersRepository.count({ where: { role: 'TENANT_ADMIN' } }),
      this.getPeriodSummary(currentMonthStart, nextMonthStart),
      this.getPeriodSummary(previousMonthStart, currentMonthStart),
      this.getChart(input.months),
      this.getRecentLogs(input.logsLimit),
      this.getSuperAdminTenantsTable(input.tableLimit, currentMonthStart, nextMonthStart),
    ]);

    const bookingsDelta = this.getDelta(currentSummary.bookings, previousSummary.bookings);
    const revenueDelta = this.getDelta(currentSummary.revenue, previousSummary.revenue);

    return {
      role: 'SUPER_ADMIN',
      generated_at: new Date().toISOString(),
      months: input.months,
      currency: currentSummary.currency,
      metrics: [
        {
          key: 'active_tenants',
          label: 'Tenants activos',
          value: String(activeTenants),
          hint: `de ${totalTenants} tenants`,
          delta: null,
        },
        {
          key: 'tenant_admins',
          label: 'Tenant admins',
          value: String(totalTenantAdmins),
          hint: 'administradores registrados',
          delta: null,
        },
        {
          key: 'bookings_month',
          label: 'Bookings del mes',
          value: this.formatInteger(currentSummary.bookings),
          hint: `mes anterior: ${this.formatInteger(previousSummary.bookings)}`,
          delta: bookingsDelta,
        },
        {
          key: 'revenue_month',
          label: 'Revenue del mes',
          value: this.formatCurrency(currentSummary.revenue, currentSummary.currency),
          hint: `mes anterior: ${this.formatCurrency(previousSummary.revenue, previousSummary.currency)}`,
          delta: revenueDelta,
        },
      ],
      chart,
      recent_logs: recentLogs,
      super_admin: {
        tenants: tenantsTable,
      },
    };
  }

  private async buildTenantAdminOverview(input: {
    currentUser: CurrentJwtUser;
    months: number;
    logsLimit: number;
    tableLimit: number;
  }): Promise<DashboardOverviewResponse> {
    const tenantId = input.currentUser.tenant_id;
    if (!tenantId) {
      throw new BadRequestException('El contexto del negocio es obligatorio.');
    }

    const currentMonthStart = this.getUtcMonthStart(new Date());
    const nextMonthStart = this.addUtcMonths(currentMonthStart, 1);
    const previousMonthStart = this.addUtcMonths(currentMonthStart, -1);
    const todayStart = this.getUtcDayStart(new Date());
    const tomorrowStart = this.addUtcDays(todayStart, 1);

    const [
      tenant,
      totalServices,
      activeServices,
      totalEmployees,
      activeEmployees,
      bookingsToday,
      currentSummary,
      previousSummary,
      chart,
      recentLogs,
      employeesTable,
    ] = await Promise.all([
      this.tenantRepository.findOne({ where: { id: tenantId } }),
      this.servicesRepository.count({ where: { tenant_id: tenantId } }),
      this.servicesRepository.count({ where: { tenant_id: tenantId, is_active: true } }),
      this.employeesRepository.count({ where: { tenant_id: tenantId } }),
      this.employeesRepository.count({ where: { tenant_id: tenantId, is_active: true } }),
      this.countBookingsInRange(todayStart, tomorrowStart, tenantId),
      this.getPeriodSummary(currentMonthStart, nextMonthStart, tenantId),
      this.getPeriodSummary(previousMonthStart, currentMonthStart, tenantId),
      this.getChart(input.months, tenantId),
      this.getRecentLogs(input.logsLimit, tenantId),
      this.getTenantEmployeesTable(tenantId, input.tableLimit, currentMonthStart, nextMonthStart),
    ]);

    if (!tenant) {
      throw new NotFoundException('No se encontró el negocio.');
    }

    const revenueDelta = this.getDelta(currentSummary.revenue, previousSummary.revenue);

    return {
      role: 'TENANT_ADMIN',
      generated_at: new Date().toISOString(),
      months: input.months,
      currency: currentSummary.currency,
      metrics: [
        {
          key: 'active_services',
          label: 'Servicios activos',
          value: this.formatInteger(activeServices),
          hint: `de ${this.formatInteger(totalServices)} servicios`,
          delta: null,
        },
        {
          key: 'active_employees',
          label: 'Profesionales activos',
          value: this.formatInteger(activeEmployees),
          hint: `de ${this.formatInteger(totalEmployees)} profesionales`,
          delta: null,
        },
        {
          key: 'bookings_today',
          label: 'Citas de hoy',
          value: this.formatInteger(bookingsToday),
          hint: `mes actual: ${this.formatInteger(currentSummary.bookings)}`,
          delta: null,
        },
        {
          key: 'revenue_month',
          label: 'Revenue del mes',
          value: this.formatCurrency(currentSummary.revenue, currentSummary.currency),
          hint: `mes anterior: ${this.formatCurrency(previousSummary.revenue, previousSummary.currency)}`,
          delta: revenueDelta,
        },
      ],
      chart,
      recent_logs: recentLogs,
      tenant_admin: {
        tenant: {
          id: tenant.id,
          name: tenant.name,
          slug: tenant.slug,
          is_active: tenant.is_active,
        },
        employees: employeesTable,
      },
    };
  }

  private async getPeriodSummary(
    startAt: Date,
    endAt: Date,
    tenantId?: string,
  ): Promise<PeriodSummary> {
    const qb = this.bookingsRepository
      .createQueryBuilder('booking')
      .select('COUNT(*)::int', 'bookings_count')
      .addSelect(
        `COALESCE(SUM(CASE WHEN booking.status IN (:...revenueStatuses) THEN booking.total_price ELSE 0 END), 0)::numeric`,
        'revenue_sum',
      )
      .where('booking.start_at_utc >= :startAt AND booking.start_at_utc < :endAt', {
        startAt,
        endAt,
      })
      .setParameter('revenueStatuses', [...BOOKING_REVENUE_STATUSES]);

    if (tenantId) {
      qb.andWhere('booking.tenant_id = :tenantId', { tenantId });
    }

    const summary = await qb.getRawOne<{
      bookings_count: string;
      revenue_sum: string;
    }>();

    const currency = await this.resolvePeriodCurrency(startAt, endAt, tenantId);

    return {
      bookings: this.toNumber(summary?.bookings_count),
      revenue: this.toNumber(summary?.revenue_sum),
      currency,
    };
  }

  private async resolvePeriodCurrency(
    startAt: Date,
    endAt: Date,
    tenantId?: string,
  ): Promise<string> {
    const qb = this.bookingsRepository
      .createQueryBuilder('booking')
      .select('booking.currency', 'currency')
      .addSelect('COUNT(*)::int', 'count')
      .where('booking.start_at_utc >= :startAt AND booking.start_at_utc < :endAt', {
        startAt,
        endAt,
      })
      .groupBy('booking.currency')
      .orderBy('COUNT(*)', 'DESC')
      .limit(1);

    if (tenantId) {
      qb.andWhere('booking.tenant_id = :tenantId', { tenantId });
    }

    const topCurrency = await qb.getRawOne<{ currency: string }>();
    return topCurrency?.currency || 'USD';
  }

  private async getChart(months: number, tenantId?: string): Promise<DashboardChartPoint[]> {
    const monthStarts = this.buildMonthStarts(months);
    const rangeStart = monthStarts[0];
    const rangeEnd = this.addUtcMonths(this.getUtcMonthStart(new Date()), 1);

    const qb = this.bookingsRepository
      .createQueryBuilder('booking')
      .select(`TO_CHAR(DATE_TRUNC('month', booking.start_at_utc), 'YYYY-MM')`, 'month_key')
      .addSelect('COUNT(*)::int', 'bookings_count')
      .addSelect(
        `COUNT(*) FILTER (WHERE booking.status IN ('${BOOKING_CANCELLATION_STATUSES.join("','")}'))::int`,
        'cancelled_count',
      )
      .addSelect(
        `COALESCE(SUM(CASE WHEN booking.status IN (:...revenueStatuses) THEN booking.total_price ELSE 0 END), 0)::numeric`,
        'revenue_sum',
      )
      .where('booking.start_at_utc >= :rangeStart AND booking.start_at_utc < :rangeEnd', {
        rangeStart,
        rangeEnd,
      })
      .setParameter('revenueStatuses', [...BOOKING_REVENUE_STATUSES])
      .groupBy(`DATE_TRUNC('month', booking.start_at_utc)`)
      .orderBy(`DATE_TRUNC('month', booking.start_at_utc)`, 'ASC');

    if (tenantId) {
      qb.andWhere('booking.tenant_id = :tenantId', { tenantId });
    }

    const rows = await qb.getRawMany<{
      month_key: string;
      bookings_count: string;
      cancelled_count: string;
      revenue_sum: string;
    }>();

    const rowsByMonth = new Map(rows.map((row) => [row.month_key, row]));

    return monthStarts.map((monthStart) => {
      const monthKey = this.toMonthKey(monthStart);
      const row = rowsByMonth.get(monthKey);

      return {
        month_key: monthKey,
        month_label: this.formatMonthLabel(monthStart),
        bookings: this.toNumber(row?.bookings_count),
        revenue: this.toNumber(row?.revenue_sum),
        cancelled: this.toNumber(row?.cancelled_count),
      };
    });
  }

  private async getRecentLogs(limit: number, tenantId?: string): Promise<DashboardRecentLog[]> {
    const qb = this.auditLogsRepository
      .createQueryBuilder('audit')
      .leftJoin('audit.actor', 'actor')
      .leftJoin('audit.tenant', 'tenant')
      .select('audit.id', 'id')
      .addSelect('audit.created_at', 'created_at')
      .addSelect('audit.action', 'action')
      .addSelect('audit.message', 'message')
      .addSelect('audit.metadata', 'metadata')
      .addSelect('actor.name', 'actor_name')
      .addSelect('actor.email', 'actor_email')
      .addSelect('tenant.name', 'tenant_name')
      .addSelect('tenant.slug', 'tenant_slug')
      .orderBy('audit.created_at', 'DESC')
      .limit(limit);

    if (tenantId) {
      qb.where('audit.tenant_id = :tenantId', { tenantId });
    }

    const rows = await qb.getRawMany<{
      id: string;
      created_at: Date;
      action: string;
      message: string | null;
      metadata: Record<string, unknown> | null;
      actor_name: string | null;
      actor_email: string | null;
      tenant_name: string | null;
      tenant_slug: string | null;
    }>();

    return rows.map((row) => ({
      id: row.id,
      created_at: new Date(row.created_at).toISOString(),
      action: row.action,
      message: resolveAuditMessage({
        action: row.action,
        message: row.message,
        metadata: row.metadata,
      }),
      actor_name: row.actor_name,
      actor_email: row.actor_email,
      tenant_name: row.tenant_name,
      tenant_slug: row.tenant_slug,
    }));
  }

  private async getSuperAdminTenantsTable(
    limit: number,
    monthStart: Date,
    nextMonthStart: Date,
  ): Promise<DashboardTenantTableRow[]> {
    const [tenants, tenantAdminsRows, employeeAggRows, bookingAggRows] = await Promise.all([
      this.tenantRepository.find({ order: { name: 'ASC' } }),
      this.usersRepository
        .createQueryBuilder('user')
        .select('user.tenant_id', 'tenant_id')
        .addSelect('user.name', 'name')
        .addSelect('user.email', 'email')
        .addSelect('user.is_active', 'is_active')
        .addSelect('user.created_at', 'created_at')
        .where('user.role = :role', { role: 'TENANT_ADMIN' })
        .andWhere('user.tenant_id IS NOT NULL')
        .orderBy('user.created_at', 'ASC')
        .getRawMany<{
          tenant_id: string;
          name: string;
          email: string;
          is_active: boolean | string;
          created_at: Date;
        }>(),
      this.employeesRepository
        .createQueryBuilder('employee')
        .select('employee.tenant_id', 'tenant_id')
        .addSelect('COUNT(*)::int', 'total_count')
        .addSelect(
          'COUNT(*) FILTER (WHERE employee.is_active = true)::int',
          'active_count',
        )
        .groupBy('employee.tenant_id')
        .getRawMany<{
          tenant_id: string;
          total_count: string;
          active_count: string;
        }>(),
      this.bookingsRepository
        .createQueryBuilder('booking')
        .select('booking.tenant_id', 'tenant_id')
        .addSelect('COUNT(*)::int', 'bookings_count')
        .addSelect(
          `COALESCE(SUM(CASE WHEN booking.status IN (:...revenueStatuses) THEN booking.total_price ELSE 0 END), 0)::numeric`,
          'revenue_sum',
        )
        .where('booking.start_at_utc >= :monthStart AND booking.start_at_utc < :nextMonthStart', {
          monthStart,
          nextMonthStart,
        })
        .setParameter('revenueStatuses', [...BOOKING_REVENUE_STATUSES])
        .groupBy('booking.tenant_id')
        .getRawMany<{
          tenant_id: string;
          bookings_count: string;
          revenue_sum: string;
        }>(),
    ]);
    const tenantLogoByTenant = await this.getTenantLogosByTenantId(
      tenants.map((tenant) => tenant.id),
    );

    const tenantAdminsCountByTenant = new Map<string, number>();
    const primaryAdminByTenant = new Map<string, { name: string; email: string }>();

    for (const row of tenantAdminsRows) {
      if (!row.tenant_id) continue;
      tenantAdminsCountByTenant.set(
        row.tenant_id,
        (tenantAdminsCountByTenant.get(row.tenant_id) ?? 0) + 1,
      );

      const current = primaryAdminByTenant.get(row.tenant_id);
      const rowIsActive = this.toBoolean(row.is_active);
      if (!current) {
        primaryAdminByTenant.set(row.tenant_id, {
          name: row.name,
          email: row.email,
        });
        continue;
      }
      if (!rowIsActive) continue;
      primaryAdminByTenant.set(row.tenant_id, {
        name: row.name,
        email: row.email,
      });
    }

    const employeeAggByTenant = new Map(
      employeeAggRows.map((row) => [
        row.tenant_id,
        {
          total_count: this.toNumber(row.total_count),
          active_count: this.toNumber(row.active_count),
        },
      ]),
    );

    const bookingsAggByTenant = new Map(
      bookingAggRows.map((row) => [
        row.tenant_id,
        {
          bookings_count: this.toNumber(row.bookings_count),
          revenue_sum: this.toNumber(row.revenue_sum),
        },
      ]),
    );

    return tenants
      .map<DashboardTenantTableRow>((tenant) => {
        const admin = primaryAdminByTenant.get(tenant.id);
        const employeeAgg = employeeAggByTenant.get(tenant.id);
        const bookingAgg = bookingsAggByTenant.get(tenant.id);

        return {
          tenant_id: tenant.id,
          tenant_name: tenant.name,
          tenant_slug: tenant.slug,
          tenant_logo_url: tenantLogoByTenant.get(tenant.id) ?? null,
          tenant_is_active: tenant.is_active,
          primary_admin_name: admin?.name ?? null,
          primary_admin_email: admin?.email ?? null,
          tenant_admins_count: tenantAdminsCountByTenant.get(tenant.id) ?? 0,
          active_employees_count: employeeAgg?.active_count ?? 0,
          total_employees_count: employeeAgg?.total_count ?? 0,
          bookings_this_month: bookingAgg?.bookings_count ?? 0,
          revenue_this_month: bookingAgg?.revenue_sum ?? 0,
        };
      })
      .sort((left, right) => {
        if (right.bookings_this_month !== left.bookings_this_month) {
          return right.bookings_this_month - left.bookings_this_month;
        }
        return left.tenant_name.localeCompare(right.tenant_name);
      })
      .slice(0, limit);
  }

  private async getTenantLogosByTenantId(
    tenantIds: string[],
  ): Promise<Map<string, string | null>> {
    if (tenantIds.length === 0) {
      return new Map();
    }

    const rows = await this.tenantSettingsRepository
      .createQueryBuilder('settings')
      .select('settings.tenant_id', 'tenant_id')
      .addSelect('settings.logo_url', 'logo_url')
      .where('settings.tenant_id IN (:...tenantIds)', { tenantIds })
      .getRawMany<{
        tenant_id: string;
        logo_url: string | null;
      }>();

    return new Map(rows.map((row) => {
      const normalizedLogo = row.logo_url?.trim() || null;
      const logoUrl =
        normalizedLogo && normalizedLogo !== '/wegox-logo.svg'
          ? normalizedLogo
          : null;
      return [row.tenant_id, logoUrl];
    }));
  }

  private async getTenantEmployeesTable(
    tenantId: string,
    limit: number,
    monthStart: Date,
    nextMonthStart: Date,
  ): Promise<DashboardEmployeeTableRow[]> {
    const [employees, bookingAggRows, lastBookingRows] = await Promise.all([
      this.employeesRepository.find({
        where: { tenant_id: tenantId },
        order: { name: 'ASC' },
      }),
      this.bookingsRepository
        .createQueryBuilder('booking')
        .select('booking.employee_id', 'employee_id')
        .addSelect('COUNT(*)::int', 'bookings_count')
        .addSelect(
          `COALESCE(SUM(CASE WHEN booking.status IN (:...revenueStatuses) THEN booking.total_price ELSE 0 END), 0)::numeric`,
          'revenue_sum',
        )
        .where('booking.tenant_id = :tenantId', { tenantId })
        .andWhere('booking.start_at_utc >= :monthStart AND booking.start_at_utc < :nextMonthStart', {
          monthStart,
          nextMonthStart,
        })
        .setParameter('revenueStatuses', [...BOOKING_REVENUE_STATUSES])
        .groupBy('booking.employee_id')
        .getRawMany<{
          employee_id: string;
          bookings_count: string;
          revenue_sum: string;
        }>(),
      this.bookingsRepository
        .createQueryBuilder('booking')
        .select('booking.employee_id', 'employee_id')
        .addSelect('MAX(booking.start_at_utc)', 'last_booking_at')
        .where('booking.tenant_id = :tenantId', { tenantId })
        .groupBy('booking.employee_id')
        .getRawMany<{
          employee_id: string;
          last_booking_at: Date | null;
        }>(),
    ]);

    const bookingAggByEmployee = new Map(
      bookingAggRows.map((row) => [
        row.employee_id,
        {
          bookings_count: this.toNumber(row.bookings_count),
          revenue_sum: this.toNumber(row.revenue_sum),
        },
      ]),
    );
    const lastBookingByEmployee = new Map(
      lastBookingRows.map((row) => [
        row.employee_id,
        row.last_booking_at ? new Date(row.last_booking_at).toISOString() : null,
      ]),
    );

    return employees
      .map<DashboardEmployeeTableRow>((employee) => {
        const bookingAgg = bookingAggByEmployee.get(employee.id);
        return {
          employee_id: employee.id,
          employee_name: employee.name,
          employee_email: employee.email,
          employee_is_active: employee.is_active,
          bookings_this_month: bookingAgg?.bookings_count ?? 0,
          revenue_this_month: bookingAgg?.revenue_sum ?? 0,
          last_booking_at: lastBookingByEmployee.get(employee.id) ?? null,
        };
      })
      .sort((left, right) => {
        if (right.bookings_this_month !== left.bookings_this_month) {
          return right.bookings_this_month - left.bookings_this_month;
        }
        return left.employee_name.localeCompare(right.employee_name);
      })
      .slice(0, limit);
  }

  private normalizeMonths(value?: number): number {
    if (!value || Number.isNaN(value)) return 6;
    return Math.max(3, Math.min(12, Math.floor(value)));
  }

  private normalizeLogsLimit(value?: number): number {
    if (!value || Number.isNaN(value)) return 5;
    return Math.max(3, Math.min(20, Math.floor(value)));
  }

  private normalizeTableLimit(value?: number): number {
    if (!value || Number.isNaN(value)) return 8;
    return Math.max(5, Math.min(30, Math.floor(value)));
  }

  private getUtcMonthStart(date: Date): Date {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1, 0, 0, 0, 0));
  }

  private getUtcDayStart(date: Date): Date {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0));
  }

  private addUtcMonths(date: Date, months: number): Date {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1, 0, 0, 0, 0));
  }

  private addUtcDays(date: Date, days: number): Date {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + days, 0, 0, 0, 0));
  }

  private buildMonthStarts(months: number): Date[] {
    const currentMonthStart = this.getUtcMonthStart(new Date());
    const monthStarts: Date[] = [];

    for (let offset = months - 1; offset >= 0; offset -= 1) {
      monthStarts.push(this.addUtcMonths(currentMonthStart, -offset));
    }

    return monthStarts;
  }

  private toMonthKey(date: Date): string {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  }

  private formatMonthLabel(date: Date): string {
    return new Intl.DateTimeFormat('es-ES', {
      month: 'short',
      year: '2-digit',
      timeZone: 'UTC',
    }).format(date);
  }

  private getDelta(currentValue: number, previousValue: number): string | null {
    if (previousValue <= 0) {
      return currentValue > 0 ? '+100%' : null;
    }
    const delta = ((currentValue - previousValue) / previousValue) * 100;
    if (!Number.isFinite(delta)) return null;
    const sign = delta >= 0 ? '+' : '';
    return `${sign}${delta.toFixed(1)}%`;
  }

  private formatInteger(value: number): string {
    return new Intl.NumberFormat('es-ES', {
      maximumFractionDigits: 0,
    }).format(value);
  }

  private formatCurrency(value: number, currency: string): string {
    try {
      return new Intl.NumberFormat('es-ES', {
        style: 'currency',
        currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(value);
    } catch {
      return `${value.toFixed(2)} ${currency}`;
    }
  }

  private toBoolean(value: unknown): boolean {
    return value === true || value === 'true' || value === 't' || value === 1 || value === '1';
  }

  private toNumber(value: unknown): number {
    if (value === null || value === undefined) return 0;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private async countBookingsInRange(
    startAt: Date,
    endAt: Date,
    tenantId?: string,
  ): Promise<number> {
    const qb = this.bookingsRepository
      .createQueryBuilder('booking')
      .select('COUNT(*)::int', 'count')
      .where('booking.start_at_utc >= :startAt AND booking.start_at_utc < :endAt', {
        startAt,
        endAt,
      });

    if (tenantId) {
      qb.andWhere('booking.tenant_id = :tenantId', { tenantId });
    }

    const result = await qb.getRawOne<{ count: string }>();
    return this.toNumber(result?.count);
  }
}
