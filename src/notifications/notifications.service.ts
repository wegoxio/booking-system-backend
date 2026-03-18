import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Booking } from 'src/bookings/entities/booking.entity';
import { TenantSettingsService } from 'src/tenant-settings/tenant-settings.service';
import { Tenant } from 'src/tenant/entities/tenant.entity';
import { User } from 'src/users/entities/user.entity';
import { Repository } from 'typeorm';
import { buildBookingLifecycleEmail } from './templates/booking-email.template';
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
    event: BookingNotificationEvent,
  ): Promise<void> {
    if (!this.configService.get<boolean>('MAIL_ENABLED', false)) {
      return;
    }

    try {
      const appPublicUrl = this.configService.get<string>('APP_PUBLIC_URL');
      if (!appPublicUrl) {
        throw new Error('APP_PUBLIC_URL is not configured');
      }
      const assetBaseUrl = this.resolveMailAssetBaseUrl(appPublicUrl);

      const [tenant, settings, tenantAdmins] = await Promise.all([
        this.tenantsRepository.findOne({
          where: { id: booking.tenant_id },
        }),
        this.tenantSettingsService.findByTenantId(booking.tenant_id),
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

      if (!tenant) {
        throw new Error(`Tenant not found for booking ${booking.id}`);
      }

      const business: BookingNotificationBusinessContext = {
        tenantId: tenant.id,
        tenantName: tenant.name,
        tenantSlug: tenant.slug,
        settingsUpdatedAt: settings.updated_at.toISOString(),
        logoKey: settings.logo_key,
        branding: settings.branding,
        theme: settings.theme,
      };

      const payload: BookingNotificationPayload = {
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
        })),
      };

      const deliveries: Array<{
        audience: BookingNotificationAudience;
        recipient: MailRecipient;
      }> = [
        ...tenantAdmins.map((admin) => ({
          audience: 'TENANT_ADMIN' as const,
          recipient: {
            email: admin.email,
            name: admin.name,
          },
        })),
      ];

      if (payload.employeeEmail) {
        deliveries.push({
          audience: 'EMPLOYEE',
          recipient: {
            email: payload.employeeEmail,
            name: payload.employeeName,
          },
        });
      }

      if (payload.customerEmail) {
        deliveries.push({
          audience: 'CUSTOMER',
          recipient: {
            email: payload.customerEmail,
            name: payload.customerName,
          },
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

      const replyTo = this.configService.get<string>('MAIL_REPLY_TO_EMAIL') ?? null;

      const results = await Promise.allSettled(
        dedupedDeliveries.map(async (delivery) => {
          const rendered = buildBookingLifecycleEmail({
            event,
            audience: delivery.audience,
            business,
            booking: payload,
            appPublicUrl,
            assetBaseUrl,
          });

          await this.emailProvider.send({
            to: delivery.recipient,
            fromName: business.branding.appName || business.tenantName,
            subject: rendered.subject,
            html: rendered.html,
            text: rendered.text,
            replyTo,
            idempotencyKey: this.buildIdempotencyKey(
              event,
              booking.id,
              delivery.audience,
              delivery.recipient.email,
            ),
          });
        }),
      );

      const failures = results.filter((result) => result.status === 'rejected');
      if (failures.length > 0) {
        failures.forEach((failure) => {
          const reason =
            failure.status === 'rejected' ? failure.reason : 'Unknown error';
          this.logger.error(
            `Failed to deliver booking notification for booking ${booking.id}: ${String(reason)}`,
          );
        });
      }
    } catch (error) {
      this.logger.error(
        `Unable to process booking notifications for booking ${booking.id}: ${String(error)}`,
      );
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

  private buildIdempotencyKey(
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
