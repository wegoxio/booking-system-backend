import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Booking } from '../bookings/entities/booking.entity';
import { TenantSettingsService } from '../tenant-settings/tenant-settings.service';
import { Tenant } from '../tenant/entities/tenant.entity';
import { User } from '../users/entities/user.entity';
import { Repository } from 'typeorm';
import { buildBookingLifecycleEmail } from './templates/booking-email.template';
import { buildBookingCalendarAttachment } from './templates/booking-calendar.ics';
import {
  buildPasswordResetEmail,
  buildTenantAdminInvitationEmail,
} from './templates/account-access-email.template';
import type {
  BookingNotificationAudience,
  BookingNotificationBusinessContext,
  BookingNotificationEvent,
  BookingNotificationPayload,
  MailRecipient,
} from './notifications.types';
import {
  EMAIL_PROVIDER,
  type EmailProvider,
} from './providers/email-provider.interface';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @InjectRepository(Tenant)
    private readonly tenantsRepository: Repository<Tenant>,
    private readonly tenantSettingsService: TenantSettingsService,
    private readonly configService: ConfigService,
    @Inject(EMAIL_PROVIDER)
    private readonly emailProvider: EmailProvider,
  ) {}

  async sendBookingLifecycleNotifications(
    booking: Booking,
    event: Extract<
      BookingNotificationEvent,
      'BOOKING_CREATED' | 'BOOKING_COMPLETED' | 'BOOKING_CANCELLED'
    >,
  ): Promise<void> {
    if (!this.configService.get<boolean>('MAIL_ENABLED', false)) {
      this.logger.debug(
        `Skipping booking notification ${event} for booking ${booking.id}: MAIL_ENABLED=false`,
      );
      return;
    }

    try {
      const [context, tenantAdmins] = await Promise.all([
        this.buildBookingNotificationContext(booking),
        this.usersRepository.find({
          where: {
            tenant_id: booking.tenant_id,
            role: 'TENANT_ADMIN',
            is_active: true,
          },
          order: {
            created_at: 'ASC',
          },
        }),
      ]);

      const deliveries: Array<{
        audience: BookingNotificationAudience;
        recipient: MailRecipient;
      }> = tenantAdmins
        .map((admin) => this.toRecipient(admin.email, admin.name))
        .filter((recipient): recipient is MailRecipient => Boolean(recipient))
        .map((recipient) => ({
          audience: 'TENANT_ADMIN' as const,
          recipient,
        }));

      const employeeRecipient = this.toRecipient(
        context.payload.employeeEmail,
        context.payload.employeeName,
      );
      if (employeeRecipient) {
        deliveries.push({
          audience: 'EMPLOYEE',
          recipient: employeeRecipient,
        });
      }

      const customerRecipient = this.toRecipient(
        context.payload.customerEmail,
        context.payload.customerName,
      );
      if (customerRecipient) {
        deliveries.push({
          audience: 'CUSTOMER',
          recipient: customerRecipient,
        });
      }

      const dedupedDeliveries = deliveries.filter(
        (delivery, index, list) =>
          list.findIndex(
            (candidate) =>
              candidate.audience === delivery.audience &&
              candidate.recipient.email.toLowerCase() ===
                delivery.recipient.email.toLowerCase(),
          ) === index,
      );

      if (dedupedDeliveries.length === 0) {
        this.logger.warn(
          `No valid recipients for booking notification ${event}. booking_id=${booking.id} tenant_id=${booking.tenant_id} source=${booking.source}`,
        );
        return;
      }

      const adminRecipientsCount = dedupedDeliveries.filter(
        (delivery) => delivery.audience === 'TENANT_ADMIN',
      ).length;
      const employeeRecipientsCount = dedupedDeliveries.filter(
        (delivery) => delivery.audience === 'EMPLOYEE',
      ).length;
      const customerRecipientsCount = dedupedDeliveries.filter(
        (delivery) => delivery.audience === 'CUSTOMER',
      ).length;

      this.logger.debug(
        `Dispatching booking notification ${event} for booking ${booking.id}. recipients=${dedupedDeliveries.length} admins=${adminRecipientsCount} employees=${employeeRecipientsCount} customers=${customerRecipientsCount}`,
      );

      const results = await Promise.allSettled(
        dedupedDeliveries.map((delivery) =>
          this.sendBookingEmailToRecipient({
            event,
            audience: delivery.audience,
            recipient: delivery.recipient,
            business: context.business,
            booking: context.payload,
            appPublicUrl: context.appPublicUrl,
            assetBaseUrl: context.assetBaseUrl,
            idempotencyKey: this.buildBookingIdempotencyKey(
              event,
              booking.id,
              delivery.audience,
              delivery.recipient.email,
            ),
          }),
        ),
      );

      const failures = results.filter((result) => result.status === 'rejected');
      if (failures.length > 0) {
        failures.forEach((failure, index) => {
          const reason =
            failure.status === 'rejected' ? failure.reason : 'Unknown error';
          const recipient = dedupedDeliveries[index];
          this.logger.error(
            `Failed to deliver booking notification ${event} for booking ${booking.id} to ${recipient?.audience ?? 'UNKNOWN'} (${recipient ? this.maskEmail(recipient.recipient.email) : 'unknown'}): ${String(reason)}`,
          );
        });
      } else {
        this.logger.debug(
          `Booking notification ${event} delivered for booking ${booking.id}. sent=${dedupedDeliveries.length}`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Unable to process booking notifications ${event} for booking ${booking.id}: ${String(error)}`,
      );
    }
  }

  async sendBookingReminderNotification(input: {
    booking: Booking;
    reminderId: string;
    audience: Extract<BookingNotificationAudience, 'CUSTOMER' | 'EMPLOYEE'>;
    recipient: MailRecipient;
  }): Promise<void> {
    if (!this.configService.get<boolean>('MAIL_ENABLED', false)) {
      return;
    }

    try {
      const context = await this.buildBookingNotificationContext(input.booking);

      await this.sendBookingEmailToRecipient({
        event: 'BOOKING_REMINDER_DAY_BEFORE',
        audience: input.audience,
        recipient: input.recipient,
        business: context.business,
        booking: context.payload,
        appPublicUrl: context.appPublicUrl,
        assetBaseUrl: context.assetBaseUrl,
        idempotencyKey: this.buildReminderIdempotencyKey(
          input.reminderId,
          input.audience,
          input.recipient.email,
        ),
      });
    } catch (error) {
      this.logger.error(
        `Unable to deliver booking reminder ${input.reminderId}: ${String(error)}`,
      );
      throw error;
    }
  }

  async sendTenantAdminInvitationEmail(input: {
    email: string;
    name: string;
    tenantName: string;
    setupUrl: string;
    expiresAt: Date;
    idempotencyKey: string;
  }): Promise<void> {
    const rendered = buildTenantAdminInvitationEmail({
      tenantName: input.tenantName,
      setupUrl: input.setupUrl,
      expiresAt: input.expiresAt,
    });

    await this.sendTransactionalAccessEmail({
      to: {
        email: input.email,
        name: input.name,
      },
      fromName: input.tenantName,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      idempotencyKey: input.idempotencyKey,
      fallbackUrl: input.setupUrl,
    });
  }

  async sendPasswordResetEmail(input: {
    email: string;
    name: string;
    businessName: string;
    resetUrl: string;
    expiresAt: Date;
    idempotencyKey: string;
  }): Promise<void> {
    const rendered = buildPasswordResetEmail({
      businessName: input.businessName,
      resetUrl: input.resetUrl,
      expiresAt: input.expiresAt,
    });

    await this.sendTransactionalAccessEmail({
      to: {
        email: input.email,
        name: input.name,
      },
      fromName: input.businessName,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      idempotencyKey: input.idempotencyKey,
      fallbackUrl: input.resetUrl,
    });
  }

  private async buildBookingNotificationContext(booking: Booking): Promise<{
    appPublicUrl: string;
    assetBaseUrl: string;
    business: BookingNotificationBusinessContext;
    payload: BookingNotificationPayload;
  }> {
    const appPublicUrl = this.configService.get<string>('APP_PUBLIC_URL');
    if (!appPublicUrl) {
      throw new Error('APP_PUBLIC_URL is not configured');
    }

    const [tenant, settings] = await Promise.all([
      this.tenantsRepository.findOne({
        where: { id: booking.tenant_id },
      }),
      this.tenantSettingsService.findByTenantId(booking.tenant_id),
    ]);

    if (!tenant) {
      throw new Error(`Tenant not found for booking ${booking.id}`);
    }

    return {
      appPublicUrl,
      assetBaseUrl: this.resolveMailAssetBaseUrl(appPublicUrl),
      business: {
        tenantId: tenant.id,
        tenantName: tenant.name,
        tenantSlug: tenant.slug,
        settingsUpdatedAt: settings.updated_at.toISOString(),
        logoKey: settings.logo_key,
        branding: settings.branding,
        theme: settings.theme,
      },
      payload: this.buildBookingNotificationPayload(booking),
    };
  }

  private buildBookingNotificationPayload(
    booking: Booking,
  ): BookingNotificationPayload {
    return {
      bookingId: booking.id,
      status: booking.status as BookingNotificationPayload['status'],
      customerName: booking.customer_name,
      customerEmail: booking.customer_email,
      customerPhone: booking.customer_phone,
      employeeName: booking.employee?.name ?? 'Profesional',
      employeeEmail: booking.employee?.email ?? '',
      employeeTimezone: booking.employee?.schedule_timezone ?? 'UTC',
      startAtUtc: booking.start_at_utc,
      endAtUtc: booking.end_at_utc,
      durationMinutes: booking.total_duration_minutes,
      totalPrice: booking.total_price,
      currency: booking.currency,
      source: booking.source,
      notes: booking.notes,
      cancellationReason: booking.cancellation_reason,
      services: booking.items.map((item) => ({
        name: item.service_name_snapshot,
        durationMinutes:
          item.duration_minutes_snapshot +
          item.buffer_before_minutes_snapshot +
          item.buffer_after_minutes_snapshot,
        price: item.price_snapshot,
        currency: item.currency_snapshot,
        instructions: item.instructions_snapshot,
      })),
    };
  }

  private async sendBookingEmailToRecipient(input: {
    event: BookingNotificationEvent;
    audience: BookingNotificationAudience;
    recipient: MailRecipient;
    business: BookingNotificationBusinessContext;
    booking: BookingNotificationPayload;
    appPublicUrl: string;
    assetBaseUrl: string;
    idempotencyKey: string;
  }): Promise<void> {
    const rendered = buildBookingLifecycleEmail({
      event: input.event,
      audience: input.audience,
      business: input.business,
      booking: input.booking,
      appPublicUrl: input.appPublicUrl,
      assetBaseUrl: input.assetBaseUrl,
    });
    const calendarAttachment = buildBookingCalendarAttachment({
      event: input.event,
      recipient: input.recipient,
      business: input.business,
      booking: input.booking,
    });

    const replyTo = this.configService.get<string>('MAIL_REPLY_TO_EMAIL') ?? null;

    await this.emailProvider.send({
      to: input.recipient,
      fromName: input.business.branding.appName || input.business.tenantName,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      attachments: calendarAttachment ? [calendarAttachment] : undefined,
      replyTo,
      idempotencyKey: input.idempotencyKey,
    });
  }

  private buildBookingIdempotencyKey(
    event: BookingNotificationEvent,
    bookingId: string,
    audience: BookingNotificationAudience,
    email: string,
  ): string {
    const normalizedEmail = email
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9@._-]/g, '');

    return `booking/${event.toLowerCase()}/${bookingId}/${audience.toLowerCase()}/${normalizedEmail}`.slice(
      0,
      256,
    );
  }

  private buildReminderIdempotencyKey(
    reminderId: string,
    audience: Extract<BookingNotificationAudience, 'CUSTOMER' | 'EMPLOYEE'>,
    email: string,
  ): string {
    const normalizedEmail = email
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9@._-]/g, '');

    return `booking/reminder/${reminderId}/${audience.toLowerCase()}/${normalizedEmail}`.slice(
      0,
      256,
    );
  }

  private toRecipient(
    email: string | null | undefined,
    name?: string | null,
  ): MailRecipient | null {
    const normalizedEmail = this.normalizeEmail(email);
    if (!normalizedEmail) {
      return null;
    }

    return {
      email: normalizedEmail,
      name,
    };
  }

  private normalizeEmail(email: string | null | undefined): string | null {
    const normalized = email?.trim().toLowerCase() ?? '';
    if (!normalized) {
      return null;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
      return null;
    }

    return normalized;
  }

  private maskEmail(email: string): string {
    const [local, domain] = email.split('@');
    if (!local || !domain) {
      return email;
    }

    if (local.length <= 2) {
      return `***@${domain}`;
    }

    return `${local.slice(0, 2)}***@${domain}`;
  }

  private resolveMailAssetBaseUrl(appPublicUrl: string): string {
    const explicitMailAssetBaseUrl =
      this.configService.get<string>('MAIL_ASSET_BASE_URL')?.trim() || null;
    if (explicitMailAssetBaseUrl) {
      return explicitMailAssetBaseUrl.replace(/\/+$/, '');
    }

    const bucket = this.configService.get<string>('AWS_S3_BUCKET')?.trim() || null;
    const region = this.configService.get<string>('AWS_REGION')?.trim() || null;
    if (bucket && region) {
      return `https://${bucket}.s3.${region}.amazonaws.com`;
    }

    const configuredPublicBaseUrl =
      this.configService.get<string>('AWS_S3_PUBLIC_BASE_URL')?.trim() || null;
    if (configuredPublicBaseUrl) {
      return configuredPublicBaseUrl.replace(/\/+$/, '');
    }

    return appPublicUrl.replace(/\/+$/, '');
  }

  private async sendTransactionalAccessEmail(input: {
    to: MailRecipient;
    fromName: string;
    subject: string;
    html: string;
    text: string;
    idempotencyKey: string;
    fallbackUrl: string;
  }): Promise<void> {
    if (!this.configService.get<boolean>('MAIL_ENABLED', false)) {
      const nodeEnv = this.configService.get<string>('NODE_ENV', 'development');
      if (nodeEnv === 'development') {
        this.logger.warn(
          `MAIL_ENABLED=false. Link temporal para ${input.to.email}: ${input.fallbackUrl}`,
        );
        return;
      }

      throw new Error('MAIL_ENABLED=false');
    }

    const replyTo = this.configService.get<string>('MAIL_REPLY_TO_EMAIL') ?? null;

    await this.emailProvider.send({
      to: input.to,
      fromName: input.fromName,
      subject: input.subject,
      html: input.html,
      text: input.text,
      replyTo,
      idempotencyKey: input.idempotencyKey,
    });
  }
}
