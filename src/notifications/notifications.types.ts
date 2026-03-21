import type { BookingStatus } from '../bookings/bookings.constants';
import type {
  TenantBrandingSettings,
  TenantThemeSettings,
} from '../tenant-settings/tenant-settings.types';

export type BookingNotificationEvent =
  | 'BOOKING_CREATED'
  | 'BOOKING_COMPLETED'
  | 'BOOKING_CANCELLED'
  | 'BOOKING_REMINDER_DAY_BEFORE';

export type BookingNotificationAudience =
  | 'TENANT_ADMIN'
  | 'EMPLOYEE'
  | 'CUSTOMER';

export type MailRecipient = {
  email: string;
  name?: string | null;
};

export type EmailAttachment = {
  filename: string;
  content: string;
  contentType?: string | null;
};

export type BookingNotificationBusinessContext = {
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  settingsUpdatedAt: string;
  logoKey: string | null;
  branding: TenantBrandingSettings;
  theme: TenantThemeSettings;
};

export type BookingNotificationPayload = {
  bookingId: string;
  status: BookingStatus;
  customerName: string;
  customerEmail: string | null;
  customerPhone: string | null;
  employeeName: string;
  employeeEmail: string;
  employeeTimezone: string;
  startAtUtc: Date;
  endAtUtc: Date;
  durationMinutes: number;
  totalPrice: string;
  currency: string;
  source: string;
  notes: string | null;
  cancellationReason: string | null;
  services: Array<{
    name: string;
    durationMinutes: number;
    price: string;
    currency: string;
    instructions: string | null;
  }>;
};

export type EmailSendInput = {
  to: MailRecipient;
  fromName?: string | null;
  subject: string;
  html: string;
  text: string;
  attachments?: EmailAttachment[];
  replyTo?: string | null;
  idempotencyKey: string;
};
