export const BOOKING_REMINDER_AUDIENCES = ['CUSTOMER', 'EMPLOYEE'] as const;
export const BOOKING_REMINDER_CHANNELS = ['EMAIL'] as const;
export const BOOKING_REMINDER_TYPES = ['DAY_BEFORE_17H'] as const;
export const BOOKING_REMINDER_STATUSES = [
  'PENDING',
  'PROCESSING',
  'SENT',
  'FAILED',
  'SKIPPED',
] as const;

export type BookingReminderAudience =
  (typeof BOOKING_REMINDER_AUDIENCES)[number];
export type BookingReminderChannel =
  (typeof BOOKING_REMINDER_CHANNELS)[number];
export type BookingReminderType = (typeof BOOKING_REMINDER_TYPES)[number];
export type BookingReminderStatus = (typeof BOOKING_REMINDER_STATUSES)[number];

export const BOOKING_REMINDER_DISPATCHABLE_BOOKING_STATUSES = [
  'PENDING',
  'CONFIRMED',
] as const;

export const BOOKING_REMINDER_SKIP_REASONS = {
  BOOKING_NOT_ELIGIBLE: 'Booking is no longer eligible for reminder delivery.',
  RECIPIENT_EMAIL_MISSING: 'Recipient email is missing at processing time.',
  STALE_PROCESSING: 'Reminder processing lease expired before completion.',
} as const;
