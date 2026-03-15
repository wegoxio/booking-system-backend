export const BOOKING_BLOCKING_STATUSES = ['PENDING', 'CONFIRMED', 'IN_PROGRESS'] as const;

export const BOOKING_FINAL_STATUSES = ['COMPLETED', 'CANCELLED', 'NO_SHOW'] as const;

export const BOOKING_STATUSES = [
  ...BOOKING_BLOCKING_STATUSES,
  ...BOOKING_FINAL_STATUSES,
] as const;

export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export const BOOKING_SOURCES = ['ADMIN', 'WEB', 'API'] as const;
export type BookingSource = (typeof BOOKING_SOURCES)[number];
