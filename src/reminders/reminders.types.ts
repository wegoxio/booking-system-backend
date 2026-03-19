import type { Booking } from 'src/bookings/entities/booking.entity';
import type {
  BookingReminderAudience,
  BookingReminderChannel,
  BookingReminderType,
} from './reminders.constants';

export type BookingReminderDraft = {
  tenant_id: string;
  booking_id: string;
  audience: BookingReminderAudience;
  channel: BookingReminderChannel;
  type: BookingReminderType;
  target_email: string;
  scheduled_for_utc: Date;
};

export type ReminderSchedulingRunKind = 'daily_dispatch' | 'backfill';

export type ReminderSchedulingResult = {
  triggered: boolean;
  kind: ReminderSchedulingRunKind;
  timezone: string;
  local_today: string;
  local_tomorrow: string;
  booking_count: number;
  candidate_count: number;
  scheduled_count: number;
  skipped_missing_email_count: number;
  reason?: 'disabled' | 'not_due' | 'before_cutoff';
};

export type ReminderProcessingResult = {
  disabled: boolean;
  claimed_count: number;
  sent_count: number;
  failed_count: number;
  skipped_count: number;
};

export type ReminderCandidateBooking = Booking & {
  employee: Booking['employee'];
  items: Booking['items'];
};
