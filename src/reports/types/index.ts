import type { UserRole } from '../../users/entities/user.entity';
import type {
  ReportBookingSource,
  ReportBookingStatus,
  ReportGroupBy,
} from '../dto/reports-overview-query.dto';

export type ReportsSummary = {
  bookings_total: number;
  completed_count: number;
  cancelled_count: number;
  no_show_count: number;
  completion_rate: number;
  cancellation_rate: number;
  no_show_rate: number;
  revenue_total_usd: number;
  avg_ticket_usd: number;
  avg_duration_minutes: number;
  avg_lead_time_hours: number;
};

export type ReportsTimeSeriesPoint = {
  period_key: string;
  period_label: string;
  bookings_total: number;
  completed_count: number;
  cancelled_count: number;
  no_show_count: number;
  revenue_total_usd: number;
  avg_ticket_usd: number;
};

export type ReportsTopService = {
  service_id: string;
  service_name: string;
  tenant_id: string | null;
  tenant_name: string | null;
  tenant_slug: string | null;
  sold_items_count: number;
  bookings_count: number;
  revenue_total_usd: number;
  avg_price_usd: number;
};

export type ReportsTopEmployee = {
  employee_id: string;
  employee_name: string;
  avatar_url: string | null;
  bookings_count: number;
  completed_count: number;
  revenue_total_usd: number;
  avg_ticket_usd: number;
};

export type ReportsSourceBreakdownRow = {
  source: ReportBookingSource;
  bookings_count: number;
  completed_count: number;
  cancelled_count: number;
  revenue_total_usd: number;
};

export type ReportsReminderSummary = {
  scheduled_total: number;
  sent_count: number;
  failed_count: number;
  skipped_count: number;
  pending_count: number;
  processing_count: number;
  sent_rate: number;
};

export type ReportsOverviewResponse = {
  generated_at: string;
  scope: {
    role: UserRole;
    tenant_id: string | null;
    tenant_name: string | null;
    tenant_slug: string | null;
  };
  filters: {
    date_from: string;
    date_to: string;
    timezone: string;
    group_by: ReportGroupBy;
    tenant_id: string | null;
    employee_id: string | null;
    service_id: string | null;
    source: ReportBookingSource | null;
    status: ReportBookingStatus | null;
    top_limit: number;
  };
  summary: ReportsSummary;
  time_series: ReportsTimeSeriesPoint[];
  top_services: ReportsTopService[];
  top_employees: ReportsTopEmployee[];
  source_breakdown: ReportsSourceBreakdownRow[];
  reminders: ReportsReminderSummary;
};
