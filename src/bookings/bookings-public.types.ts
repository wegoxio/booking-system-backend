export type PublicBookingEmployee = {
  id: string;
  name: string;
};

export type PublicBookingService = {
  id: string;
  name: string;
  description: string | null;
  duration_minutes: number;
  price: string;
  currency: string;
  is_active: boolean;
  employees: PublicBookingEmployee[];
};

export type PublicBookingItem = {
  id: string;
  service_id: string;
  service_name_snapshot: string;
  duration_minutes_snapshot: number;
  price_snapshot: string;
  currency_snapshot: string;
  sort_order: number;
};

export type PublicBookingConfirmation = {
  id: string;
  status: string;
  start_at_utc: string;
  end_at_utc: string;
  total_duration_minutes: number;
  total_price: string;
  currency: string;
  customer_name: string;
  employee: PublicBookingEmployee | null;
  items: PublicBookingItem[];
};
