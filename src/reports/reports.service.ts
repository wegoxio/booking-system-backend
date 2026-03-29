import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import ExcelJS from 'exceljs';
import type { CurrentJwtUser } from '../auth/types';
import {
  addDaysToDateString,
  formatDateInTimeZone,
  getUtcRangeForLocalDate,
} from '../bookings/bookings.time-utils';
import {
  BOOKING_REVENUE_STATUSES,
} from '../bookings/bookings.constants';
import { Booking } from '../bookings/entities/booking.entity';
import { BookingItem } from '../bookings/entities/booking-item.entity';
import { BookingReminder } from '../reminders/entities/booking-reminder.entity';
import { Tenant } from '../tenant/entities/tenant.entity';
import { type ObjectLiteral, Repository, SelectQueryBuilder } from 'typeorm';
import {
  REPORT_GROUP_BY_VALUES,
  type ReportBookingSource,
  type ReportBookingStatus,
  type ReportGroupBy,
  type ReportsOverviewQueryDto,
} from './dto/reports-overview-query.dto';
import type {
  ReportsOverviewResponse,
  ReportsReminderSummary,
  ReportsSourceBreakdownRow,
  ReportsSummary,
  ReportsTimeSeriesPoint,
  ReportsTopEmployee,
  ReportsTopService,
} from './types';

type NormalizedReportsQuery = {
  dateFrom: string;
  dateTo: string;
  rangeStartUtc: Date;
  rangeEndUtc: Date;
  timeZone: string;
  groupBy: ReportGroupBy;
  tenantId: string | null;
  employeeId: string | null;
  serviceId: string | null;
  source: ReportBookingSource | null;
  status: ReportBookingStatus | null;
  topLimit: number;
};

const PERIOD_INTERVAL_BY_GROUP: Record<ReportGroupBy, 'day' | 'week' | 'month'> = {
  day: 'day',
  week: 'week',
  month: 'month',
};

const EXCEL_COLORS = {
  titleBackground: 'FF0F172A',
  titleText: 'FFFFFFFF',
  subtitleBackground: 'FFE2E8F0',
  subtitleText: 'FF0F172A',
  headerBackground: 'FF1F2937',
  headerText: 'FFFFFFFF',
  sectionBackground: 'FFF1F5F9',
  sectionText: 'FF0F172A',
  stripedBackground: 'FFF8FAFC',
  subtotalBackground: 'FFE0F2FE',
  subtotalText: 'FF0C4A6E',
  totalBackground: 'FFDCFCE7',
  totalText: 'FF14532D',
  border: 'FFE5E7EB',
};

const EXCEL_NUMBER_FORMATS = {
  integer: '#,##0',
  currencyUsd: '$#,##0.00',
  decimal: '#,##0.00',
  percentFraction: '0.00%',
  percentValue: '0.00"%"',
};

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(Booking)
    private readonly bookingsRepository: Repository<Booking>,
    @InjectRepository(BookingItem)
    private readonly bookingItemsRepository: Repository<BookingItem>,
    @InjectRepository(BookingReminder)
    private readonly remindersRepository: Repository<BookingReminder>,
  ) {}

  async getOverview(
    currentUser: CurrentJwtUser,
    query: ReportsOverviewQueryDto,
  ): Promise<ReportsOverviewResponse> {
    const filters = this.normalizeQuery(currentUser, query);

    const [summary, timeSeries, topServices, topEmployees, sourceBreakdown, reminders] =
      await Promise.all([
        this.buildSummary(filters),
        this.buildTimeSeries(filters),
        this.buildTopServices(filters),
        this.buildTopEmployees(filters),
        this.buildSourceBreakdown(filters),
        this.buildReminderSummary(filters),
      ]);

    return {
      generated_at: new Date().toISOString(),
      scope: {
        role: currentUser.role,
        tenant_id: filters.tenantId,
        tenant_name: currentUser.tenant?.name ?? null,
        tenant_slug: currentUser.tenant?.slug ?? null,
      },
      filters: {
        date_from: filters.dateFrom,
        date_to: filters.dateTo,
        timezone: filters.timeZone,
        group_by: filters.groupBy,
        tenant_id: filters.tenantId,
        employee_id: filters.employeeId,
        service_id: filters.serviceId,
        source: filters.source,
        status: filters.status,
        top_limit: filters.topLimit,
      },
      summary,
      time_series: timeSeries,
      top_services: topServices,
      top_employees: topEmployees,
      source_breakdown: sourceBreakdown,
      reminders,
    };
  }

  async buildExcelExport(
    currentUser: CurrentJwtUser,
    query: ReportsOverviewQueryDto,
  ): Promise<{ fileName: string; content: Buffer }> {
    const report = await this.getOverview(currentUser, query);
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Wegox Booking';
    workbook.created = new Date();
    workbook.modified = new Date();

    this.fillSummarySheet(workbook, report);
    this.fillTimeSeriesSheet(workbook, report);
    this.fillTopServicesSheet(workbook, report);
    this.fillTopEmployeesSheet(workbook, report);
    this.fillSourceSheet(workbook, report);
    this.fillRemindersSheet(workbook, report);

    const xlsxData = await workbook.xlsx.writeBuffer();
    const content = Buffer.isBuffer(xlsxData)
      ? xlsxData
      : Buffer.from(xlsxData);

    return {
      fileName: `reportes-${report.filters.date_from}-a-${report.filters.date_to}.xlsx`,
      content,
    };
  }

  private normalizeQuery(
    currentUser: CurrentJwtUser,
    query: ReportsOverviewQueryDto,
  ): NormalizedReportsQuery {
    const timeZone = (query.timezone?.trim() || 'UTC').trim();
    this.assertValidTimezone(timeZone);

    const dateTo = query.date_to || formatDateInTimeZone(new Date(), timeZone);
    const dateFrom = query.date_from || addDaysToDateString(dateTo, -29);

    if (dateFrom > dateTo) {
      throw new BadRequestException('date_from debe ser menor o igual a date_to');
    }

    const rangeStartUtc = getUtcRangeForLocalDate(dateFrom, timeZone).start;
    const rangeEndUtc = getUtcRangeForLocalDate(dateTo, timeZone).end;

    const groupBy = query.group_by || 'day';
    if (!REPORT_GROUP_BY_VALUES.includes(groupBy)) {
      throw new BadRequestException('El valor de group_by es invÃ¡lido');
    }

    const topLimit = Math.max(3, Math.min(query.top_limit ?? 10, 30));
    const tenantId =
      currentUser.role === 'TENANT_ADMIN'
        ? currentUser.tenant_id
        : query.tenant_id || null;

    if (currentUser.role === 'TENANT_ADMIN' && !tenantId) {
      throw new BadRequestException('El contexto del negocio es obligatorio.');
    }

    return {
      dateFrom,
      dateTo,
      rangeStartUtc,
      rangeEndUtc,
      timeZone,
      groupBy,
      tenantId,
      employeeId: query.employee_id || null,
      serviceId: query.service_id || null,
      source: query.source || null,
      status: query.status || null,
      topLimit,
    };
  }

  private async buildSummary(filters: NormalizedReportsQuery): Promise<ReportsSummary> {
    const qb = this.bookingsRepository
      .createQueryBuilder('booking')
      .select('COUNT(*)::int', 'bookings_total')
      .addSelect(
        `COUNT(*) FILTER (WHERE booking.status = 'COMPLETED')::int`,
        'completed_count',
      )
      .addSelect(
        `COUNT(*) FILTER (WHERE booking.status = 'CANCELLED')::int`,
        'cancelled_count',
      )
      .addSelect(
        `COUNT(*) FILTER (WHERE booking.status = 'NO_SHOW')::int`,
        'no_show_count',
      )
      .addSelect(
        `COALESCE(SUM(CASE WHEN booking.status IN (:...revenueStatuses) THEN booking.total_price ELSE 0 END), 0)::numeric`,
        'revenue_total_usd',
      )
      .addSelect('COALESCE(AVG(booking.total_duration_minutes), 0)::numeric', 'avg_duration_minutes')
      .addSelect(
        'COALESCE(AVG(EXTRACT(EPOCH FROM (booking.start_at_utc - booking.created_at)) / 3600), 0)::numeric',
        'avg_lead_time_hours',
      )
      .setParameter('revenueStatuses', [...BOOKING_REVENUE_STATUSES]);

    this.applyBookingFilters(qb, filters);

    const raw = await qb.getRawOne<{
      bookings_total: string;
      completed_count: string;
      cancelled_count: string;
      no_show_count: string;
      revenue_total_usd: string;
      avg_duration_minutes: string;
      avg_lead_time_hours: string;
    }>();

    const bookingsTotal = this.toNumber(raw?.bookings_total);
    const completedCount = this.toNumber(raw?.completed_count);
    const cancelledCount = this.toNumber(raw?.cancelled_count);
    const noShowCount = this.toNumber(raw?.no_show_count);
    const revenueTotal = this.toNumber(raw?.revenue_total_usd);

    return {
      bookings_total: bookingsTotal,
      completed_count: completedCount,
      cancelled_count: cancelledCount,
      no_show_count: noShowCount,
      completion_rate: this.toRate(completedCount, bookingsTotal),
      cancellation_rate: this.toRate(cancelledCount, bookingsTotal),
      no_show_rate: this.toRate(noShowCount, bookingsTotal),
      revenue_total_usd: revenueTotal,
      avg_ticket_usd: completedCount > 0 ? revenueTotal / completedCount : 0,
      avg_duration_minutes: this.toNumber(raw?.avg_duration_minutes),
      avg_lead_time_hours: this.toNumber(raw?.avg_lead_time_hours),
    };
  }

  private async buildTimeSeries(
    filters: NormalizedReportsQuery,
  ): Promise<ReportsTimeSeriesPoint[]> {
    const periodExpression = this.buildPeriodExpression({
      column: 'booking.start_at_utc',
      groupBy: filters.groupBy,
    });

    const qb = this.bookingsRepository
      .createQueryBuilder('booking')
      .select(`TO_CHAR(${periodExpression}::date, 'YYYY-MM-DD')`, 'period_key')
      .addSelect('COUNT(*)::int', 'bookings_total')
      .addSelect(
        `COUNT(*) FILTER (WHERE booking.status = 'COMPLETED')::int`,
        'completed_count',
      )
      .addSelect(
        `COUNT(*) FILTER (WHERE booking.status = 'CANCELLED')::int`,
        'cancelled_count',
      )
      .addSelect(
        `COUNT(*) FILTER (WHERE booking.status = 'NO_SHOW')::int`,
        'no_show_count',
      )
      .addSelect(
        `COALESCE(SUM(CASE WHEN booking.status IN (:...revenueStatuses) THEN booking.total_price ELSE 0 END), 0)::numeric`,
        'revenue_total_usd',
      )
      .setParameter('timeZone', filters.timeZone)
      .setParameter('revenueStatuses', [...BOOKING_REVENUE_STATUSES])
      .groupBy(periodExpression)
      .orderBy(periodExpression, 'ASC');

    this.applyBookingFilters(qb, filters);

    const rows = await qb.getRawMany<{
      period_key: string;
      bookings_total: string;
      completed_count: string;
      cancelled_count: string;
      no_show_count: string;
      revenue_total_usd: string;
    }>();

    const rowsByKey = new Map(rows.map((row) => [row.period_key, row]));
    const periodKeys = this.buildPeriodKeys(filters);

    return periodKeys.map((periodKey) => {
      const row = rowsByKey.get(periodKey);
      const completedCount = this.toNumber(row?.completed_count);
      const revenueTotal = this.toNumber(row?.revenue_total_usd);

      return {
        period_key: periodKey,
        period_label: this.formatPeriodLabel(periodKey, filters.groupBy),
        bookings_total: this.toNumber(row?.bookings_total),
        completed_count: completedCount,
        cancelled_count: this.toNumber(row?.cancelled_count),
        no_show_count: this.toNumber(row?.no_show_count),
        revenue_total_usd: revenueTotal,
        avg_ticket_usd: completedCount > 0 ? revenueTotal / completedCount : 0,
      };
    });
  }

  private async buildTopServices(
    filters: NormalizedReportsQuery,
  ): Promise<ReportsTopService[]> {
    const qb = this.bookingItemsRepository
      .createQueryBuilder('item')
      .innerJoin(Booking, 'booking', 'booking.id = item.booking_id')
      .leftJoin(Tenant, 'tenant', 'tenant.id = booking.tenant_id')
      .select('item.service_id', 'service_id')
      .addSelect('item.service_name_snapshot', 'service_name')
      .addSelect('booking.tenant_id', 'tenant_id')
      .addSelect('tenant.name', 'tenant_name')
      .addSelect('tenant.slug', 'tenant_slug')
      .addSelect('COUNT(*)::int', 'sold_items_count')
      .addSelect('COUNT(DISTINCT booking.id)::int', 'bookings_count')
      .addSelect(
        `COALESCE(SUM(CASE WHEN booking.status IN (:...revenueStatuses) THEN item.price_snapshot ELSE 0 END), 0)::numeric`,
        'revenue_total_usd',
      )
      .setParameter('revenueStatuses', [...BOOKING_REVENUE_STATUSES])
      .groupBy('item.service_id')
      .addGroupBy('item.service_name_snapshot')
      .addGroupBy('booking.tenant_id')
      .addGroupBy('tenant.name')
      .addGroupBy('tenant.slug')
      .orderBy('sold_items_count', 'DESC')
      .addOrderBy('revenue_total_usd', 'DESC')
      .limit(filters.topLimit);

    this.applyBookingFilters(qb, filters, {
      alias: 'booking',
      includeServiceFilter: false,
    });

    if (filters.serviceId) {
      qb.andWhere('item.service_id = :serviceId', { serviceId: filters.serviceId });
    }

    const rows = await qb.getRawMany<{
      service_id: string;
      service_name: string;
      tenant_id: string | null;
      tenant_name: string | null;
      tenant_slug: string | null;
      sold_items_count: string;
      bookings_count: string;
      revenue_total_usd: string;
    }>();

    return rows.map((row) => {
      const soldItemsCount = this.toNumber(row.sold_items_count);
      const revenueTotal = this.toNumber(row.revenue_total_usd);
      return {
        service_id: row.service_id,
        service_name: row.service_name,
        tenant_id: row.tenant_id,
        tenant_name: row.tenant_name,
        tenant_slug: row.tenant_slug,
        sold_items_count: soldItemsCount,
        bookings_count: this.toNumber(row.bookings_count),
        revenue_total_usd: revenueTotal,
        avg_price_usd: soldItemsCount > 0 ? revenueTotal / soldItemsCount : 0,
      };
    });
  }

  private async buildTopEmployees(
    filters: NormalizedReportsQuery,
  ): Promise<ReportsTopEmployee[]> {
    const qb = this.bookingsRepository
      .createQueryBuilder('booking')
      .leftJoin('booking.employee', 'employee')
      .select('booking.employee_id', 'employee_id')
      .addSelect(`COALESCE(employee.name, 'Profesional')`, 'employee_name')
      .addSelect('employee.avatar_url', 'avatar_url')
      .addSelect('COUNT(*)::int', 'bookings_count')
      .addSelect(
        `COUNT(*) FILTER (WHERE booking.status = 'COMPLETED')::int`,
        'completed_count',
      )
      .addSelect(
        `COALESCE(SUM(CASE WHEN booking.status IN (:...revenueStatuses) THEN booking.total_price ELSE 0 END), 0)::numeric`,
        'revenue_total_usd',
      )
      .setParameter('revenueStatuses', [...BOOKING_REVENUE_STATUSES])
      .groupBy('booking.employee_id')
      .addGroupBy('employee.name')
      .addGroupBy('employee.avatar_url')
      .orderBy('bookings_count', 'DESC')
      .addOrderBy('revenue_total_usd', 'DESC')
      .limit(filters.topLimit);

    this.applyBookingFilters(qb, filters);

    const rows = await qb.getRawMany<{
      employee_id: string;
      employee_name: string;
      avatar_url: string | null;
      bookings_count: string;
      completed_count: string;
      revenue_total_usd: string;
    }>();

    return rows.map((row) => {
      const completedCount = this.toNumber(row.completed_count);
      const revenueTotal = this.toNumber(row.revenue_total_usd);

      return {
        employee_id: row.employee_id,
        employee_name: row.employee_name,
        avatar_url: row.avatar_url,
        bookings_count: this.toNumber(row.bookings_count),
        completed_count: completedCount,
        revenue_total_usd: revenueTotal,
        avg_ticket_usd: completedCount > 0 ? revenueTotal / completedCount : 0,
      };
    });
  }

  private async buildSourceBreakdown(
    filters: NormalizedReportsQuery,
  ): Promise<ReportsSourceBreakdownRow[]> {
    const sourceNormalizationExpression =
      "CASE WHEN booking.source = 'WEB' THEN 'WEB' ELSE 'MANUAL' END";

    const qb = this.bookingsRepository
      .createQueryBuilder('booking')
      .select(sourceNormalizationExpression, 'source')
      .addSelect('COUNT(*)::int', 'bookings_count')
      .addSelect(
        `COUNT(*) FILTER (WHERE booking.status = 'COMPLETED')::int`,
        'completed_count',
      )
      .addSelect(
        `COUNT(*) FILTER (WHERE booking.status IN ('CANCELLED', 'NO_SHOW'))::int`,
        'cancelled_count',
      )
      .addSelect(
        `COALESCE(SUM(CASE WHEN booking.status IN (:...revenueStatuses) THEN booking.total_price ELSE 0 END), 0)::numeric`,
        'revenue_total_usd',
      )
      .setParameter('revenueStatuses', [...BOOKING_REVENUE_STATUSES])
      .groupBy(sourceNormalizationExpression)
      .orderBy('bookings_count', 'DESC');

    this.applyBookingFilters(qb, filters, {
      alias: 'booking',
      includeStatusFilter: false,
    });

    const rows = await qb.getRawMany<{
      source: ReportBookingSource;
      bookings_count: string;
      completed_count: string;
      cancelled_count: string;
      revenue_total_usd: string;
    }>();

    return rows.map((row) => ({
      source: row.source,
      bookings_count: this.toNumber(row.bookings_count),
      completed_count: this.toNumber(row.completed_count),
      cancelled_count: this.toNumber(row.cancelled_count),
      revenue_total_usd: this.toNumber(row.revenue_total_usd),
    }));
  }

  private async buildReminderSummary(
    filters: NormalizedReportsQuery,
  ): Promise<ReportsReminderSummary> {
    const qb = this.remindersRepository
      .createQueryBuilder('reminder')
      .innerJoin('reminder.booking', 'booking')
      .select('COUNT(*)::int', 'scheduled_total')
      .addSelect(
        `COUNT(*) FILTER (WHERE reminder.status = 'SENT')::int`,
        'sent_count',
      )
      .addSelect(
        `COUNT(*) FILTER (WHERE reminder.status = 'FAILED')::int`,
        'failed_count',
      )
      .addSelect(
        `COUNT(*) FILTER (WHERE reminder.status = 'SKIPPED')::int`,
        'skipped_count',
      )
      .addSelect(
        `COUNT(*) FILTER (WHERE reminder.status = 'PENDING')::int`,
        'pending_count',
      )
      .addSelect(
        `COUNT(*) FILTER (WHERE reminder.status = 'PROCESSING')::int`,
        'processing_count',
      );

    this.applyBookingFilters(qb, filters);

    const raw = await qb.getRawOne<{
      scheduled_total: string;
      sent_count: string;
      failed_count: string;
      skipped_count: string;
      pending_count: string;
      processing_count: string;
    }>();

    const scheduledTotal = this.toNumber(raw?.scheduled_total);
    const sentCount = this.toNumber(raw?.sent_count);

    return {
      scheduled_total: scheduledTotal,
      sent_count: sentCount,
      failed_count: this.toNumber(raw?.failed_count),
      skipped_count: this.toNumber(raw?.skipped_count),
      pending_count: this.toNumber(raw?.pending_count),
      processing_count: this.toNumber(raw?.processing_count),
      sent_rate: this.toRate(sentCount, scheduledTotal),
    };
  }

  private applyBookingFilters(
    qb: SelectQueryBuilder<ObjectLiteral>,
    filters: NormalizedReportsQuery,
    options?: {
      alias?: string;
      includeServiceFilter?: boolean;
      includeStatusFilter?: boolean;
    },
  ): void {
    const alias = options?.alias ?? 'booking';
    const includeServiceFilter = options?.includeServiceFilter ?? true;
    const includeStatusFilter = options?.includeStatusFilter ?? true;

    qb.andWhere(`${alias}.start_at_utc >= :rangeStartUtc`, {
      rangeStartUtc: filters.rangeStartUtc,
    }).andWhere(`${alias}.start_at_utc < :rangeEndUtc`, {
      rangeEndUtc: filters.rangeEndUtc,
    });

    if (filters.tenantId) {
      qb.andWhere(`${alias}.tenant_id = :tenantId`, { tenantId: filters.tenantId });
    }

    if (filters.employeeId) {
      qb.andWhere(`${alias}.employee_id = :employeeId`, {
        employeeId: filters.employeeId,
      });
    }

    if (filters.source) {
      if (filters.source === 'WEB') {
        qb.andWhere(`${alias}.source = :sourceWeb`, { sourceWeb: 'WEB' });
      } else {
        qb.andWhere(`${alias}.source <> :sourceWeb`, { sourceWeb: 'WEB' });
      }
    }

    if (includeStatusFilter && filters.status) {
      qb.andWhere(`${alias}.status = :status`, { status: filters.status });
    }

    if (includeServiceFilter && filters.serviceId) {
      qb.andWhere(
        `EXISTS (SELECT 1 FROM booking_items bi_filter WHERE bi_filter.booking_id = ${alias}.id AND bi_filter.service_id = :serviceId)`,
        { serviceId: filters.serviceId },
      );
    }
  }

  private buildPeriodExpression(input: {
    column: string;
    groupBy: ReportGroupBy;
  }): string {
    return `DATE_TRUNC('${PERIOD_INTERVAL_BY_GROUP[input.groupBy]}', ${input.column} AT TIME ZONE :timeZone)`;
  }

  private buildPeriodKeys(filters: NormalizedReportsQuery): string[] {
    const keys: string[] = [];

    if (filters.groupBy === 'day') {
      let current = filters.dateFrom;
      while (current <= filters.dateTo) {
        keys.push(current);
        current = addDaysToDateString(current, 1);
      }
      return keys;
    }

    if (filters.groupBy === 'week') {
      let current = this.alignDateToWeekStart(filters.dateFrom);
      while (current <= filters.dateTo) {
        keys.push(current);
        current = addDaysToDateString(current, 7);
      }
      return keys;
    }

    let current = this.alignDateToMonthStart(filters.dateFrom);
    while (current <= filters.dateTo) {
      keys.push(current);
      current = this.addMonthsToDate(current, 1);
    }

    return keys;
  }

  private alignDateToWeekStart(value: string): string {
    const date = this.parseDateString(value);
    const dayOfWeek = date.getUTCDay();
    const shift = (dayOfWeek + 6) % 7;
    date.setUTCDate(date.getUTCDate() - shift);
    return this.toDateString(date);
  }

  private alignDateToMonthStart(value: string): string {
    const date = this.parseDateString(value);
    date.setUTCDate(1);
    return this.toDateString(date);
  }

  private addMonthsToDate(value: string, months: number): string {
    const date = this.parseDateString(value);
    date.setUTCMonth(date.getUTCMonth() + months, 1);
    return this.toDateString(date);
  }

  private parseDateString(value: string): Date {
    const [year, month, day] = value.split('-').map((part) => Number(part));
    return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
  }

  private toDateString(date: Date): string {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private formatPeriodLabel(periodKey: string, groupBy: ReportGroupBy): string {
    const date = this.parseDateString(periodKey);

    if (groupBy === 'day') {
      return new Intl.DateTimeFormat('es-ES', {
        day: '2-digit',
        month: 'short',
      }).format(date);
    }

    if (groupBy === 'week') {
      const weekEnd = this.parseDateString(addDaysToDateString(periodKey, 6));
      const startLabel = new Intl.DateTimeFormat('es-ES', {
        day: '2-digit',
        month: 'short',
      }).format(date);
      const endLabel = new Intl.DateTimeFormat('es-ES', {
        day: '2-digit',
        month: 'short',
      }).format(weekEnd);
      return `${startLabel} - ${endLabel}`;
    }

    return new Intl.DateTimeFormat('es-ES', {
      month: 'short',
      year: 'numeric',
    }).format(date);
  }

  private fillSummarySheet(
    workbook: ExcelJS.Workbook,
    report: ReportsOverviewResponse,
  ): void {
    const sheet = workbook.addWorksheet('Resumen');
    sheet.columns = [{ width: 34 }, { width: 24 }, { width: 34 }, { width: 30 }];

    const generatedAt = this.formatGeneratedAt(report.generated_at, report.filters.timezone);
    const tenantScope = this.resolveScopeTenantLabel(report);

    this.applySheetTitle(sheet, {
      title: 'Reporte ejecutivo de reservas',
      subtitle: `Periodo ${report.filters.date_from} a ${report.filters.date_to} | ${generatedAt}`,
      endColumn: 'D',
    });

    let currentRow = 4;
    currentRow = this.appendKeyValueBlock(
      sheet,
      currentRow,
      'Contexto del reporte',
      [
        { label: 'Rol de alcance', value: this.formatRoleLabel(report.scope.role) },
        { label: 'Negocio de alcance', value: tenantScope },
        { label: 'Agrupacion', value: this.formatGroupByLabel(report.filters.group_by) },
        { label: 'Zona horaria', value: report.filters.timezone },
        { label: 'Filtro estado', value: this.formatStatusLabel(report.filters.status) },
        { label: 'Filtro canal', value: this.formatSourceLabel(report.filters.source) },
        {
          label: 'Filtro profesional',
          value: report.filters.employee_id ? 'Aplicado' : 'Todos',
        },
        {
          label: 'Filtro servicio',
          value: report.filters.service_id ? 'Aplicado' : 'Todos',
        },
      ],
      'D',
    );

    currentRow = this.appendMetricBlock(
      sheet,
      currentRow,
      'Rendimiento de citas',
      [
        {
          label: 'Citas totales',
          value: report.summary.bookings_total,
          note: 'Volumen total en el periodo',
          numFmt: EXCEL_NUMBER_FORMATS.integer,
        },
        {
          label: 'Completadas',
          value: report.summary.completed_count,
          note: 'Citas completadas',
          numFmt: EXCEL_NUMBER_FORMATS.integer,
        },
        {
          label: 'Canceladas',
          value: report.summary.cancelled_count,
          note: 'Citas canceladas',
          numFmt: EXCEL_NUMBER_FORMATS.integer,
        },
        {
          label: 'No asistio',
          value: report.summary.no_show_count,
          note: 'Citas con inasistencia',
          numFmt: EXCEL_NUMBER_FORMATS.integer,
        },
        {
          label: 'Tasa de finalizacion',
          value: report.summary.completion_rate,
          note: 'Completadas / citas totales',
          numFmt: EXCEL_NUMBER_FORMATS.percentValue,
        },
        {
          label: 'Tasa de cancelacion',
          value: report.summary.cancellation_rate,
          note: 'Canceladas / citas totales',
          numFmt: EXCEL_NUMBER_FORMATS.percentValue,
        },
        {
          label: 'Tasa de inasistencia',
          value: report.summary.no_show_rate,
          note: 'Inasistencias / citas totales',
          numFmt: EXCEL_NUMBER_FORMATS.percentValue,
        },
      ],
      'D',
    );

    currentRow = this.appendMetricBlock(
      sheet,
      currentRow,
      'Rendimiento economico y operativo',
      [
        {
          label: 'Ingresos totales (USD)',
          value: report.summary.revenue_total_usd,
          note: 'Suma en estados monetizables',
          numFmt: EXCEL_NUMBER_FORMATS.currencyUsd,
        },
        {
          label: 'Ticket promedio (USD)',
          value: report.summary.avg_ticket_usd,
          note: 'Ingresos / completadas',
          numFmt: EXCEL_NUMBER_FORMATS.currencyUsd,
        },
        {
          label: 'Duracion promedio (min)',
          value: report.summary.avg_duration_minutes,
          note: 'Promedio de duracion de la cita',
          numFmt: EXCEL_NUMBER_FORMATS.decimal,
        },
        {
          label: 'Anticipacion promedio (horas)',
          value: report.summary.avg_lead_time_hours,
          note: 'Horas entre creacion y cita',
          numFmt: EXCEL_NUMBER_FORMATS.decimal,
        },
      ],
      'D',
    );

    this.appendMetricBlock(
      sheet,
      currentRow,
      'Recordatorios',
      [
        {
          label: 'Programados',
          value: report.reminders.scheduled_total,
          note: 'Base total de recordatorios',
          numFmt: EXCEL_NUMBER_FORMATS.integer,
        },
        {
          label: 'Enviados',
          value: report.reminders.sent_count,
          note: 'Recordatorios enviados',
          numFmt: EXCEL_NUMBER_FORMATS.integer,
        },
        {
          label: 'Fallidos',
          value: report.reminders.failed_count,
          note: 'Recordatorios con error',
          numFmt: EXCEL_NUMBER_FORMATS.integer,
        },
        {
          label: 'Saltados',
          value: report.reminders.skipped_count,
          note: 'Omitidos por reglas',
          numFmt: EXCEL_NUMBER_FORMATS.integer,
        },
        {
          label: 'Pendientes',
          value: report.reminders.pending_count,
          note: 'En cola de envio',
          numFmt: EXCEL_NUMBER_FORMATS.integer,
        },
        {
          label: 'Procesando',
          value: report.reminders.processing_count,
          note: 'Envio en curso',
          numFmt: EXCEL_NUMBER_FORMATS.integer,
        },
        {
          label: 'Tasa de envio',
          value: report.reminders.sent_rate,
          note: 'Enviados / programados',
          numFmt: EXCEL_NUMBER_FORMATS.percentValue,
        },
      ],
      'D',
    );

    sheet.views = [{ state: 'frozen', ySplit: 4 }];
  }

  private fillTimeSeriesSheet(
    workbook: ExcelJS.Workbook,
    report: ReportsOverviewResponse,
  ): void {
    const sheet = workbook.addWorksheet('Serie temporal');
    sheet.columns = [
      { width: 22 },
      { width: 12 },
      { width: 14 },
      { width: 12 },
      { width: 12 },
      { width: 14 },
      { width: 14 },
      { width: 14 },
      { width: 16 },
      { width: 18 },
    ];

    this.applySheetTitle(sheet, {
      title: 'Serie temporal de desempeño',
      subtitle: `Agrupacion: ${report.filters.group_by}`,
      endColumn: 'J',
    });

    const headerRow = 4;
    this.setRowValues(sheet, headerRow, [
      'Periodo',
      'Citas',
      'Completadas',
      'Canceladas',
      'Inasistencias',
      '% Completados',
      '% Cancelacion',
      '% Inasistencia',
      'Ingresos USD',
      'Ticket promedio USD',
    ]);
    this.applyHeaderStyle(sheet, headerRow, 1, 10);

    let currentRow = headerRow + 1;
    let totalBookings = 0;
    let totalCompleted = 0;
    let totalCancelled = 0;
    let totalNoShow = 0;
    let totalRevenue = 0;

    for (const row of report.time_series) {
      const completionRate = row.bookings_total > 0 ? row.completed_count / row.bookings_total : 0;
      const cancellationRate = row.bookings_total > 0 ? row.cancelled_count / row.bookings_total : 0;
      const noShowRate = row.bookings_total > 0 ? row.no_show_count / row.bookings_total : 0;

      this.setRowValues(sheet, currentRow, [
        row.period_label,
        row.bookings_total,
        row.completed_count,
        row.cancelled_count,
        row.no_show_count,
        completionRate,
        cancellationRate,
        noShowRate,
        row.revenue_total_usd,
        row.avg_ticket_usd,
      ]);
      this.applyBodyRowStyle(sheet.getRow(currentRow), 1, 10, currentRow % 2 === 0);

      totalBookings += row.bookings_total;
      totalCompleted += row.completed_count;
      totalCancelled += row.cancelled_count;
      totalNoShow += row.no_show_count;
      totalRevenue += row.revenue_total_usd;
      currentRow += 1;
    }

    if (report.time_series.length > 0) {
      const totalCompletion = totalBookings > 0 ? totalCompleted / totalBookings : 0;
      const totalCancel = totalBookings > 0 ? totalCancelled / totalBookings : 0;
      const totalNoShowRate = totalBookings > 0 ? totalNoShow / totalBookings : 0;
      const totalAvgTicket = totalCompleted > 0 ? totalRevenue / totalCompleted : 0;

      this.setRowValues(sheet, currentRow, [
        'TOTAL / PROMEDIO',
        totalBookings,
        totalCompleted,
        totalCancelled,
        totalNoShow,
        totalCompletion,
        totalCancel,
        totalNoShowRate,
        totalRevenue,
        totalAvgTicket,
      ]);
      this.applyTotalRowStyle(sheet.getRow(currentRow), 1, 10);
    } else {
      this.setRowValues(sheet, currentRow, ['Sin datos para este filtro.']);
      sheet.mergeCells(`A${currentRow}:J${currentRow}`);
      this.applyBodyRowStyle(sheet.getRow(currentRow), 1, 10, false);
    }

    const lastRow = currentRow;
    this.applyBorders(sheet, headerRow, lastRow, 1, 10);
    this.setNumberFormat(sheet, 2, headerRow + 1, lastRow, EXCEL_NUMBER_FORMATS.integer);
    this.setNumberFormat(sheet, 3, headerRow + 1, lastRow, EXCEL_NUMBER_FORMATS.integer);
    this.setNumberFormat(sheet, 4, headerRow + 1, lastRow, EXCEL_NUMBER_FORMATS.integer);
    this.setNumberFormat(sheet, 5, headerRow + 1, lastRow, EXCEL_NUMBER_FORMATS.integer);
    this.setNumberFormat(sheet, 6, headerRow + 1, lastRow, EXCEL_NUMBER_FORMATS.percentFraction);
    this.setNumberFormat(sheet, 7, headerRow + 1, lastRow, EXCEL_NUMBER_FORMATS.percentFraction);
    this.setNumberFormat(sheet, 8, headerRow + 1, lastRow, EXCEL_NUMBER_FORMATS.percentFraction);
    this.setNumberFormat(sheet, 9, headerRow + 1, lastRow, EXCEL_NUMBER_FORMATS.currencyUsd);
    this.setNumberFormat(sheet, 10, headerRow + 1, lastRow, EXCEL_NUMBER_FORMATS.currencyUsd);

    sheet.autoFilter = {
      from: { row: headerRow, column: 1 },
      to: { row: headerRow, column: 10 },
    };
    sheet.views = [{ state: 'frozen', ySplit: headerRow }];
  }

  private fillTopServicesSheet(
    workbook: ExcelJS.Workbook,
    report: ReportsOverviewResponse,
  ): void {
    const sheet = workbook.addWorksheet('Top servicios');
    sheet.columns = [
      { width: 30 },
      { width: 34 },
      { width: 14 },
      { width: 12 },
      { width: 16 },
      { width: 18 },
      { width: 14 },
    ];

    this.applySheetTitle(sheet, {
      title: 'Servicios mas vendidos (agrupado por negocio)',
      subtitle: 'Incluye subtotales por negocio y participacion sobre ingresos',
      endColumn: 'G',
    });

    const headerRow = 4;
    this.setRowValues(sheet, headerRow, [
      'Negocio',
      'Servicio',
      'Items vendidos',
      'Citas',
      'Ingresos USD',
      'Precio promedio USD',
      '% Ingresos',
    ]);
    this.applyHeaderStyle(sheet, headerRow, 1, 7);

    let currentRow = headerRow + 1;
    const totalRevenue = report.top_services.reduce((sum, item) => sum + item.revenue_total_usd, 0);
    const grouped = new Map<string, ReportsTopService[]>();

    for (const service of report.top_services) {
      const tenantLabel = this.resolveTenantLabel(service);
      if (!grouped.has(tenantLabel)) {
        grouped.set(tenantLabel, []);
      }
      grouped.get(tenantLabel)?.push(service);
    }

    if (grouped.size === 0) {
      this.setRowValues(sheet, currentRow, ['Sin datos para este filtro.']);
      sheet.mergeCells(`A${currentRow}:G${currentRow}`);
      this.applyBodyRowStyle(sheet.getRow(currentRow), 1, 7, false);
    } else {
      sheet.properties.outlineLevelRow = 1;
      let stripedToggle = false;

      for (const [tenantLabel, services] of grouped.entries()) {
        const tenantRevenue = services.reduce((sum, item) => sum + item.revenue_total_usd, 0);
        const tenantShare = totalRevenue > 0 ? tenantRevenue / totalRevenue : 0;

        this.setRowValues(sheet, currentRow, [
          `NEGOCIO: ${tenantLabel}`,
          '',
          '',
          '',
          '',
          '',
          tenantShare,
        ]);
        this.applySectionRowStyle(sheet.getRow(currentRow), 1, 7);
        currentRow += 1;

        let tenantItems = 0;
        let tenantBookings = 0;
        for (const service of services) {
          const serviceShare = totalRevenue > 0 ? service.revenue_total_usd / totalRevenue : 0;

          this.setRowValues(sheet, currentRow, [
            tenantLabel,
            service.service_name,
            service.sold_items_count,
            service.bookings_count,
            service.revenue_total_usd,
            service.avg_price_usd,
            serviceShare,
          ]);
          const row = sheet.getRow(currentRow);
          row.outlineLevel = 1;
          this.applyBodyRowStyle(row, 1, 7, stripedToggle);
          stripedToggle = !stripedToggle;

          tenantItems += service.sold_items_count;
          tenantBookings += service.bookings_count;
          currentRow += 1;
        }

        this.setRowValues(sheet, currentRow, [
          tenantLabel,
          'Subtotal negocio',
          tenantItems,
          tenantBookings,
          tenantRevenue,
          tenantItems > 0 ? tenantRevenue / tenantItems : 0,
          tenantShare,
        ]);
        this.applySubtotalRowStyle(sheet.getRow(currentRow), 1, 7);
        currentRow += 1;
      }
    }

    const lastRow = grouped.size === 0 ? currentRow : currentRow - 1;
    this.applyBorders(sheet, headerRow, lastRow, 1, 7);
    this.setNumberFormat(sheet, 3, headerRow + 1, lastRow, EXCEL_NUMBER_FORMATS.integer);
    this.setNumberFormat(sheet, 4, headerRow + 1, lastRow, EXCEL_NUMBER_FORMATS.integer);
    this.setNumberFormat(sheet, 5, headerRow + 1, lastRow, EXCEL_NUMBER_FORMATS.currencyUsd);
    this.setNumberFormat(sheet, 6, headerRow + 1, lastRow, EXCEL_NUMBER_FORMATS.currencyUsd);
    this.setNumberFormat(sheet, 7, headerRow + 1, lastRow, EXCEL_NUMBER_FORMATS.percentFraction);

    sheet.autoFilter = {
      from: { row: headerRow, column: 1 },
      to: { row: headerRow, column: 7 },
    };
    sheet.views = [{ state: 'frozen', ySplit: headerRow }];
  }

  private fillTopEmployeesSheet(
    workbook: ExcelJS.Workbook,
    report: ReportsOverviewResponse,
  ): void {
    const sheet = workbook.addWorksheet('Top profesionales');
    sheet.columns = [
      { width: 30 },
      { width: 50 },
      { width: 12 },
      { width: 14 },
      { width: 16 },
      { width: 16 },
      { width: 18 },
      { width: 40 },
    ];

    this.applySheetTitle(sheet, {
      title: 'Profesionales con mejor desempeño',
      subtitle: 'Incluye avatar y tasa de completados',
      endColumn: 'H',
    });

    const headerRow = 4;
    this.setRowValues(sheet, headerRow, [
      'Profesional',
      'Avatar',
      'Citas',
      'Completadas',
      '% Completados',
      'Ingresos USD',
      'Ticket promedio USD',
      'ID profesional',
    ]);
    this.applyHeaderStyle(sheet, headerRow, 1, 8);

    let currentRow = headerRow + 1;
    let totalBookings = 0;
    let totalCompleted = 0;
    let totalRevenue = 0;

    for (const row of report.top_employees) {
      const completionRate = row.bookings_count > 0 ? row.completed_count / row.bookings_count : 0;
      this.setRowValues(sheet, currentRow, [
        row.employee_name,
        row.avatar_url || '',
        row.bookings_count,
        row.completed_count,
        completionRate,
        row.revenue_total_usd,
        row.avg_ticket_usd,
        row.employee_id,
      ]);
      this.applyBodyRowStyle(sheet.getRow(currentRow), 1, 8, currentRow % 2 === 0);

      totalBookings += row.bookings_count;
      totalCompleted += row.completed_count;
      totalRevenue += row.revenue_total_usd;
      currentRow += 1;
    }

    if (report.top_employees.length > 0) {
      const totalRate = totalBookings > 0 ? totalCompleted / totalBookings : 0;
      const totalAvgTicket = totalCompleted > 0 ? totalRevenue / totalCompleted : 0;
      this.setRowValues(sheet, currentRow, [
        'TOTAL / PROMEDIO',
        '',
        totalBookings,
        totalCompleted,
        totalRate,
        totalRevenue,
        totalAvgTicket,
        '',
      ]);
      this.applyTotalRowStyle(sheet.getRow(currentRow), 1, 8);
    } else {
      this.setRowValues(sheet, currentRow, ['Sin datos para este filtro.']);
      sheet.mergeCells(`A${currentRow}:H${currentRow}`);
      this.applyBodyRowStyle(sheet.getRow(currentRow), 1, 8, false);
    }

    const lastRow = currentRow;
    this.applyBorders(sheet, headerRow, lastRow, 1, 8);
    this.setNumberFormat(sheet, 3, headerRow + 1, lastRow, EXCEL_NUMBER_FORMATS.integer);
    this.setNumberFormat(sheet, 4, headerRow + 1, lastRow, EXCEL_NUMBER_FORMATS.integer);
    this.setNumberFormat(sheet, 5, headerRow + 1, lastRow, EXCEL_NUMBER_FORMATS.percentFraction);
    this.setNumberFormat(sheet, 6, headerRow + 1, lastRow, EXCEL_NUMBER_FORMATS.currencyUsd);
    this.setNumberFormat(sheet, 7, headerRow + 1, lastRow, EXCEL_NUMBER_FORMATS.currencyUsd);

    sheet.autoFilter = {
      from: { row: headerRow, column: 1 },
      to: { row: headerRow, column: 8 },
    };
    sheet.views = [{ state: 'frozen', ySplit: headerRow }];
  }

  private fillSourceSheet(
    workbook: ExcelJS.Workbook,
    report: ReportsOverviewResponse,
  ): void {
    const sheet = workbook.addWorksheet('Canales');
    sheet.columns = [
      { width: 16 },
      { width: 12 },
      { width: 14 },
      { width: 12 },
      { width: 16 },
      { width: 16 },
      { width: 16 },
      { width: 18 },
    ];

    this.applySheetTitle(sheet, {
      title: 'desempeño por canal',
      subtitle: 'Conversion y monetizacion por origen de cita',
      endColumn: 'H',
    });

    const headerRow = 4;
    this.setRowValues(sheet, headerRow, [
      'Canal',
      'Citas',
      'Completadas',
      'Canceladas',
      '% Completados',
      '% Cancelacion',
      'Ingresos USD',
      'Ticket promedio USD',
    ]);
    this.applyHeaderStyle(sheet, headerRow, 1, 8);

    let currentRow = headerRow + 1;
    let totalBookings = 0;
    let totalCompleted = 0;
    let totalCancelled = 0;
    let totalRevenue = 0;

    for (const row of report.source_breakdown) {
      const completionRate = row.bookings_count > 0 ? row.completed_count / row.bookings_count : 0;
      const cancellationRate = row.bookings_count > 0 ? row.cancelled_count / row.bookings_count : 0;
      const avgTicket = row.completed_count > 0 ? row.revenue_total_usd / row.completed_count : 0;

      this.setRowValues(sheet, currentRow, [
        this.formatSourceLabel(row.source),
        row.bookings_count,
        row.completed_count,
        row.cancelled_count,
        completionRate,
        cancellationRate,
        row.revenue_total_usd,
        avgTicket,
      ]);
      this.applyBodyRowStyle(sheet.getRow(currentRow), 1, 8, currentRow % 2 === 0);

      totalBookings += row.bookings_count;
      totalCompleted += row.completed_count;
      totalCancelled += row.cancelled_count;
      totalRevenue += row.revenue_total_usd;
      currentRow += 1;
    }

    if (report.source_breakdown.length > 0) {
      const totalCompletion = totalBookings > 0 ? totalCompleted / totalBookings : 0;
      const totalCancellation = totalBookings > 0 ? totalCancelled / totalBookings : 0;
      const totalAvgTicket = totalCompleted > 0 ? totalRevenue / totalCompleted : 0;
      this.setRowValues(sheet, currentRow, [
        'TOTAL',
        totalBookings,
        totalCompleted,
        totalCancelled,
        totalCompletion,
        totalCancellation,
        totalRevenue,
        totalAvgTicket,
      ]);
      this.applyTotalRowStyle(sheet.getRow(currentRow), 1, 8);
    } else {
      this.setRowValues(sheet, currentRow, ['Sin datos para este filtro.']);
      sheet.mergeCells(`A${currentRow}:H${currentRow}`);
      this.applyBodyRowStyle(sheet.getRow(currentRow), 1, 8, false);
    }

    const lastRow = currentRow;
    this.applyBorders(sheet, headerRow, lastRow, 1, 8);
    this.setNumberFormat(sheet, 2, headerRow + 1, lastRow, EXCEL_NUMBER_FORMATS.integer);
    this.setNumberFormat(sheet, 3, headerRow + 1, lastRow, EXCEL_NUMBER_FORMATS.integer);
    this.setNumberFormat(sheet, 4, headerRow + 1, lastRow, EXCEL_NUMBER_FORMATS.integer);
    this.setNumberFormat(sheet, 5, headerRow + 1, lastRow, EXCEL_NUMBER_FORMATS.percentFraction);
    this.setNumberFormat(sheet, 6, headerRow + 1, lastRow, EXCEL_NUMBER_FORMATS.percentFraction);
    this.setNumberFormat(sheet, 7, headerRow + 1, lastRow, EXCEL_NUMBER_FORMATS.currencyUsd);
    this.setNumberFormat(sheet, 8, headerRow + 1, lastRow, EXCEL_NUMBER_FORMATS.currencyUsd);

    sheet.autoFilter = {
      from: { row: headerRow, column: 1 },
      to: { row: headerRow, column: 8 },
    };
    sheet.views = [{ state: 'frozen', ySplit: headerRow }];
  }

  private fillRemindersSheet(
    workbook: ExcelJS.Workbook,
    report: ReportsOverviewResponse,
  ): void {
    const sheet = workbook.addWorksheet('Recordatorios');
    sheet.columns = [{ width: 28 }, { width: 16 }, { width: 18 }, { width: 50 }];

    this.applySheetTitle(sheet, {
      title: 'Estado de recordatorios',
      subtitle: 'Seguimiento del pipeline de notificaciones',
      endColumn: 'D',
    });

    const headerRow = 4;
    this.setRowValues(sheet, headerRow, [
      'Indicador',
      'Cantidad',
      '% sobre programados',
      'Descripcion',
    ]);
    this.applyHeaderStyle(sheet, headerRow, 1, 4);

    const scheduled = report.reminders.scheduled_total;
    const asRate = (value: number): number => (scheduled > 0 ? value / scheduled : 0);

    const rows = [
      {
        label: 'Programados',
        value: scheduled,
        rate: 1,
        note: 'Base total de recordatorios',
      },
      {
        label: 'Enviados',
        value: report.reminders.sent_count,
        rate: asRate(report.reminders.sent_count),
        note: 'Entrega confirmada',
      },
      {
        label: 'Fallidos',
        value: report.reminders.failed_count,
        rate: asRate(report.reminders.failed_count),
        note: 'Intentos con error de envio',
      },
      {
        label: 'Saltados',
        value: report.reminders.skipped_count,
        rate: asRate(report.reminders.skipped_count),
        note: 'No aplica por reglas o datos faltantes',
      },
      {
        label: 'Pendientes',
        value: report.reminders.pending_count,
        rate: asRate(report.reminders.pending_count),
        note: 'Aun en cola de ejecucion',
      },
      {
        label: 'Procesando',
        value: report.reminders.processing_count,
        rate: asRate(report.reminders.processing_count),
        note: 'Intento en curso',
      },
    ];

    let currentRow = headerRow + 1;
    for (const row of rows) {
      this.setRowValues(sheet, currentRow, [row.label, row.value, row.rate, row.note]);
      this.applyBodyRowStyle(sheet.getRow(currentRow), 1, 4, currentRow % 2 === 0);
      currentRow += 1;
    }

    this.setRowValues(sheet, currentRow, [
      'Tasa global de envio',
      report.reminders.sent_count,
      report.reminders.sent_rate / 100,
      'Enviados / Programados',
    ]);
    this.applyTotalRowStyle(sheet.getRow(currentRow), 1, 4);

    const lastRow = currentRow;
    this.applyBorders(sheet, headerRow, lastRow, 1, 4);
    this.setNumberFormat(sheet, 2, headerRow + 1, lastRow, EXCEL_NUMBER_FORMATS.integer);
    this.setNumberFormat(sheet, 3, headerRow + 1, lastRow, EXCEL_NUMBER_FORMATS.percentFraction);

    sheet.autoFilter = {
      from: { row: headerRow, column: 1 },
      to: { row: headerRow, column: 4 },
    };
    sheet.views = [{ state: 'frozen', ySplit: headerRow }];
  }

  private appendKeyValueBlock(
    sheet: ExcelJS.Worksheet,
    startRow: number,
    title: string,
    rows: Array<{ label: string; value: string }>,
    endColumn: string,
  ): number {
    let currentRow = this.addSectionTitle(sheet, startRow, title, endColumn);
    this.setRowValues(sheet, currentRow, ['Campo', 'Valor']);
    this.applyHeaderStyle(sheet, currentRow, 1, 2);
    currentRow += 1;

    rows.forEach((row, index) => {
      this.setRowValues(sheet, currentRow, [row.label, row.value]);
      this.applyBodyRowStyle(sheet.getRow(currentRow), 1, 2, index % 2 === 1);
      currentRow += 1;
    });

    this.applyBorders(sheet, startRow + 1, currentRow - 1, 1, 2);
    return currentRow + 1;
  }

  private appendMetricBlock(
    sheet: ExcelJS.Worksheet,
    startRow: number,
    title: string,
    rows: Array<{
      label: string;
      value: number;
      note: string;
      numFmt: string;
    }>,
    endColumn: string,
  ): number {
    let currentRow = this.addSectionTitle(sheet, startRow, title, endColumn);
    this.setRowValues(sheet, currentRow, ['Indicador', 'Valor', 'Detalle']);
    this.applyHeaderStyle(sheet, currentRow, 1, 3);
    currentRow += 1;

    rows.forEach((row, index) => {
      this.setRowValues(sheet, currentRow, [row.label, row.value, row.note]);
      sheet.getCell(currentRow, 2).numFmt = row.numFmt;
      this.applyBodyRowStyle(sheet.getRow(currentRow), 1, 3, index % 2 === 1);
      currentRow += 1;
    });

    this.applyBorders(sheet, startRow + 1, currentRow - 1, 1, 3);
    return currentRow + 1;
  }

  private applySheetTitle(
    sheet: ExcelJS.Worksheet,
    input: {
      title: string;
      subtitle: string;
      endColumn: string;
    },
  ): void {
    sheet.mergeCells(`A1:${input.endColumn}1`);
    sheet.mergeCells(`A2:${input.endColumn}2`);

    const titleCell = sheet.getCell('A1');
    titleCell.value = input.title;
    titleCell.font = {
      bold: true,
      size: 15,
      color: { argb: EXCEL_COLORS.titleText },
    };
    titleCell.alignment = {
      vertical: 'middle',
      horizontal: 'left',
    };
    titleCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: EXCEL_COLORS.titleBackground },
    };
    sheet.getRow(1).height = 24;

    const subtitleCell = sheet.getCell('A2');
    subtitleCell.value = input.subtitle;
    subtitleCell.font = {
      size: 11,
      color: { argb: EXCEL_COLORS.subtitleText },
    };
    subtitleCell.alignment = {
      vertical: 'middle',
      horizontal: 'left',
    };
    subtitleCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: EXCEL_COLORS.subtitleBackground },
    };
    sheet.getRow(2).height = 20;
  }

  private addSectionTitle(
    sheet: ExcelJS.Worksheet,
    rowNumber: number,
    title: string,
    endColumn: string,
  ): number {
    sheet.mergeCells(`A${rowNumber}:${endColumn}${rowNumber}`);
    const cell = sheet.getCell(`A${rowNumber}`);
    cell.value = title;
    cell.font = {
      bold: true,
      color: { argb: EXCEL_COLORS.sectionText },
    };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: EXCEL_COLORS.sectionBackground },
    };
    cell.alignment = {
      vertical: 'middle',
      horizontal: 'left',
    };
    sheet.getRow(rowNumber).height = 19;
    return rowNumber + 1;
  }

  private applyHeaderStyle(
    sheet: ExcelJS.Worksheet,
    rowNumber = 1,
    startColumn = 1,
    endColumn = Math.max(startColumn, sheet.columnCount || startColumn),
  ): void {
    const headerRow = sheet.getRow(rowNumber);
    headerRow.font = {
      bold: true,
      color: { argb: EXCEL_COLORS.headerText },
    };
    for (let column = startColumn; column <= endColumn; column += 1) {
      const cell = sheet.getCell(rowNumber, column);
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: EXCEL_COLORS.headerBackground },
      };
      cell.alignment = {
        vertical: 'middle',
        horizontal: 'left',
      };
    }
    headerRow.height = 20;
  }

  private applyBodyRowStyle(
    row: ExcelJS.Row,
    startColumn: number,
    endColumn: number,
    striped: boolean,
  ): void {
    for (let column = startColumn; column <= endColumn; column += 1) {
      const cell = row.getCell(column);
      const isNumeric = typeof cell.value === 'number';
      cell.alignment = {
        vertical: 'middle',
        horizontal: isNumeric ? 'right' : 'left',
      };
      if (striped) {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: EXCEL_COLORS.stripedBackground },
        };
      }
    }
  }

  private applySectionRowStyle(
    row: ExcelJS.Row,
    startColumn: number,
    endColumn: number,
  ): void {
    row.font = {
      bold: true,
      color: { argb: EXCEL_COLORS.sectionText },
    };
    for (let column = startColumn; column <= endColumn; column += 1) {
      const cell = row.getCell(column);
      const isNumeric = typeof cell.value === 'number';
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: EXCEL_COLORS.sectionBackground },
      };
      cell.alignment = {
        vertical: 'middle',
        horizontal: isNumeric ? 'right' : 'left',
      };
    }
  }

  private applySubtotalRowStyle(
    row: ExcelJS.Row,
    startColumn: number,
    endColumn: number,
  ): void {
    row.font = {
      bold: true,
      color: { argb: EXCEL_COLORS.subtotalText },
    };
    for (let column = startColumn; column <= endColumn; column += 1) {
      const cell = row.getCell(column);
      const isNumeric = typeof cell.value === 'number';
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: EXCEL_COLORS.subtotalBackground },
      };
      cell.alignment = {
        vertical: 'middle',
        horizontal: isNumeric ? 'right' : 'left',
      };
    }
  }

  private applyTotalRowStyle(
    row: ExcelJS.Row,
    startColumn: number,
    endColumn: number,
  ): void {
    row.font = {
      bold: true,
      color: { argb: EXCEL_COLORS.totalText },
    };
    for (let column = startColumn; column <= endColumn; column += 1) {
      const cell = row.getCell(column);
      const isNumeric = typeof cell.value === 'number';
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: EXCEL_COLORS.totalBackground },
      };
      cell.alignment = {
        vertical: 'middle',
        horizontal: isNumeric ? 'right' : 'left',
      };
    }
  }

  private applyBorders(
    sheet: ExcelJS.Worksheet,
    startRow: number,
    endRow: number,
    startColumn: number,
    endColumn: number,
  ): void {
    for (let row = startRow; row <= endRow; row += 1) {
      for (let column = startColumn; column <= endColumn; column += 1) {
        const cell = sheet.getCell(row, column);
        cell.border = {
          top: { style: 'thin', color: { argb: EXCEL_COLORS.border } },
          left: { style: 'thin', color: { argb: EXCEL_COLORS.border } },
          bottom: { style: 'thin', color: { argb: EXCEL_COLORS.border } },
          right: { style: 'thin', color: { argb: EXCEL_COLORS.border } },
        };
      }
    }
  }

  private setNumberFormat(
    sheet: ExcelJS.Worksheet,
    column: number,
    startRow: number,
    endRow: number,
    numFmt: string,
  ): void {
    for (let row = startRow; row <= endRow; row += 1) {
      sheet.getCell(row, column).numFmt = numFmt;
    }
  }

  private setRowValues(
    sheet: ExcelJS.Worksheet,
    rowNumber: number,
    values: Array<string | number>,
  ): void {
    values.forEach((value, index) => {
      sheet.getCell(rowNumber, index + 1).value = value;
    });
  }

  private resolveTenantLabel(row: ReportsTopService): string {
    if (row.tenant_name) return row.tenant_name;
    if (row.tenant_slug) return row.tenant_slug;
    return 'Sin negocio';
  }

  private resolveScopeTenantLabel(report: ReportsOverviewResponse): string {
    if (report.scope.tenant_name) return report.scope.tenant_name;
    if (report.scope.tenant_slug) return report.scope.tenant_slug;
    if (report.scope.tenant_id) return 'Negocio del usuario';
    return 'Todos los negocios';
  }

  private formatRoleLabel(role: ReportsOverviewResponse['scope']['role']): string {
    if (role === 'SUPER_ADMIN') return 'Superadministrador';
    return 'Administrador';
  }

  private formatGroupByLabel(groupBy: ReportsOverviewResponse['filters']['group_by']): string {
    switch (groupBy) {
      case 'day':
        return 'Dia';
      case 'week':
        return 'Semana';
      case 'month':
        return 'Mes';
      default:
        return groupBy;
    }
  }

  private formatStatusLabel(
    status: ReportsOverviewResponse['filters']['status'],
  ): string {
    if (!status) return 'Todos';
    switch (status) {
      case 'PENDING':
        return 'Pendiente';
      case 'COMPLETED':
        return 'Completada';
      case 'CANCELLED':
        return 'Cancelada';
      case 'NO_SHOW':
        return 'No asistio';
      default:
        return status;
    }
  }

  private formatSourceLabel(
    source: ReportsOverviewResponse['filters']['source'],
  ): string {
    if (!source) return 'Todos';
    switch (source) {
      case 'WEB':
        return 'Web';
      case 'MANUAL':
        return 'Manual';
      default:
        return source;
    }
  }

  private formatGeneratedAt(value: string, timeZone: string): string {
    return new Intl.DateTimeFormat('es-ES', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone,
    }).format(new Date(value));
  }
  private assertValidTimezone(timeZone: string): void {
    try {
      new Intl.DateTimeFormat('en-US', { timeZone }).format(new Date());
    } catch {
      throw new BadRequestException('Zona horaria invÃ¡lida');
    }
  }

  private toRate(value: number, total: number): number {
    if (total <= 0) {
      return 0;
    }

    return (value / total) * 100;
  }

  private toNumber(value: unknown): number {
    if (value === null || value === undefined) {
      return 0;
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
}
