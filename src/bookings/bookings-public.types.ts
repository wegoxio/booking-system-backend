export type PublicBookingEmployee = {
  id: string;
  name: string;
  avatar_url?: string | null;
  working_days: number[];
};

export type PublicBookingService = {
  id: string;
  name: string;
  description: string | null;
  instructions: string | null;
  duration_minutes: number;
  capacity: number;
  min_capacity: number;
  max_capacity: number;
  min_party_size: number;
  max_party_size: number;
  slot_capacity: number;
  pricing_model: 'FLAT' | 'PER_PERSON';
  requires_confirmation: boolean;
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
  pricing_model_snapshot: 'FLAT' | 'PER_PERSON';
  unit_price_snapshot: string;
  quantity_snapshot: number;
  line_total_snapshot: string;
  currency_snapshot: string;
  instructions_snapshot?: string | null;
  sort_order: number;
};

export type PublicBookingConfirmation = {
  id: string;
  status: string;
  start_at_utc: string;
  end_at_utc: string;
  total_duration_minutes: number;
  party_size: number;
  total_price: string;
  currency: string;
  customer_name: string;
  employee: PublicBookingEmployee | null;
  items: PublicBookingItem[];
};

export type PublicBookingManagement = PublicBookingConfirmation & {
  can_reschedule: boolean;
};
