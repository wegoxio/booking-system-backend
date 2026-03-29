export type DashboardMetric = {
  key: string;
  label: string;
  value: string;
  hint: string;
  delta: string | null;
};

export type DashboardChartPoint = {
  month_key: string;
  month_label: string;
  bookings: number;
  revenue: number;
  cancelled: number;
};

export type DashboardRecentLog = {
  id: string;
  created_at: string;
  action: string;
  message: string;
  actor_name: string | null;
  actor_email: string | null;
  tenant_name: string | null;
  tenant_slug: string | null;
};

export type DashboardTenantTableRow = {
  tenant_id: string;
  tenant_name: string;
  tenant_slug: string;
  tenant_logo_url: string | null;
  tenant_is_active: boolean;
  primary_admin_name: string | null;
  primary_admin_email: string | null;
  tenant_admins_count: number;
  active_employees_count: number;
  total_employees_count: number;
  bookings_this_month: number;
  revenue_this_month: number;
};

export type DashboardEmployeeTableRow = {
  employee_id: string;
  employee_name: string;
  employee_email: string;
  employee_is_active: boolean;
  bookings_this_month: number;
  revenue_this_month: number;
  last_booking_at: string | null;
};

export type DashboardOverviewResponse = {
  role: 'SUPER_ADMIN' | 'TENANT_ADMIN';
  generated_at: string;
  months: number;
  currency: string;
  metrics: DashboardMetric[];
  chart: DashboardChartPoint[];
  recent_logs: DashboardRecentLog[];
  super_admin?: {
    tenants: DashboardTenantTableRow[];
  };
  tenant_admin?: {
    tenant: {
      id: string;
      name: string;
      slug: string;
      is_active: boolean;
    };
    employees: DashboardEmployeeTableRow[];
  };
};

export type PeriodSummary = {
  bookings: number;
  revenue: number;
  currency: string;
};
