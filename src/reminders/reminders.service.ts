import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import {
  addDaysToDateString,
  formatDateInTimeZone,
  getUtcRangeForLocalDate,
} from '../bookings/bookings.time-utils';
import { Booking } from '../bookings/entities/booking.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { FindManyOptions, In, Repository } from 'typeorm';
import { BookingReminder } from './entities/booking-reminder.entity';
import {
  BOOKING_REMINDER_DISPATCHABLE_BOOKING_STATUSES,
  BOOKING_REMINDER_SKIP_REASONS,
  BookingReminderAudience,
} from './reminders.constants';
import type {
  BookingReminderDraft,
  ReminderCandidateBooking,
  ReminderProcessingResult,
  ReminderSchedulingResult,
} from './reminders.types';

type LoadDueReminderOptions = {
  now: Date;
  batchSize: number;
  maxAttempts: number;
};

@Injectable()
export class RemindersService {
  private readonly logger = new Logger(RemindersService.name);

  constructor(
    @InjectRepository(BookingReminder)
    private readonly remindersRepository: Repository<BookingReminder>,
    @InjectRepository(Booking)
    private readonly bookingsRepository: Repository<Booking>,
    private readonly configService: ConfigService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async dispatchTomorrowRemindersIfDue(
    now: Date = new Date(),
  ): Promise<ReminderSchedulingResult> {
    const timezone = this.getReminderTimezone();
    const localToday = formatDateInTimeZone(now, timezone);
    const localTomorrow = addDaysToDateString(localToday, 1);

    if (!this.isRemindersEnabled()) {
      return {
        triggered: false,
        kind: 'daily_dispatch',
        timezone,
        local_today: localToday,
        local_tomorrow: localTomorrow,
        booking_count: 0,
        candidate_count: 0,
        scheduled_count: 0,
        skipped_missing_email_count: 0,
        reason: 'disabled',
      };
    }

    if (!this.isDailyDispatchDue(now, timezone)) {
      return {
        triggered: false,
        kind: 'daily_dispatch',
        timezone,
        local_today: localToday,
        local_tomorrow: localTomorrow,
        booking_count: 0,
        candidate_count: 0,
        scheduled_count: 0,
        skipped_missing_email_count: 0,
        reason: 'not_due',
      };
    }

    return this.scheduleTomorrowReminders(now, 'daily_dispatch');
  }

  async backfillMissedTomorrowReminders(
    now: Date = new Date(),
  ): Promise<ReminderSchedulingResult> {
    const timezone = this.getReminderTimezone();
    const localToday = formatDateInTimeZone(now, timezone);
    const localTomorrow = addDaysToDateString(localToday, 1);

    if (!this.isRemindersEnabled()) {
      return {
        triggered: false,
        kind: 'backfill',
        timezone,
        local_today: localToday,
        local_tomorrow: localTomorrow,
        booking_count: 0,
        candidate_count: 0,
        scheduled_count: 0,
        skipped_missing_email_count: 0,
        reason: 'disabled',
      };
    }

    if (!this.isAfterDailyCutoff(now, timezone)) {
      return {
        triggered: false,
        kind: 'backfill',
        timezone,
        local_today: localToday,
        local_tomorrow: localTomorrow,
        booking_count: 0,
        candidate_count: 0,
        scheduled_count: 0,
        skipped_missing_email_count: 0,
        reason: 'before_cutoff',
      };
    }

    return this.scheduleTomorrowReminders(now, 'backfill');
  }

  async processDueReminders(
    now: Date = new Date(),
  ): Promise<ReminderProcessingResult> {
    if (!this.isRemindersEnabled()) {
      return {
        disabled: true,
        claimed_count: 0,
        sent_count: 0,
        failed_count: 0,
        skipped_count: 0,
      };
    }

    const batchSize = this.getReminderBatchSize();
    const maxAttempts = this.getReminderMaxAttempts();
    const candidates = await this.loadDueReminderCandidates({
      now,
      batchSize,
      maxAttempts,
    });

    let claimedCount = 0;
    let sentCount = 0;
    let failedCount = 0;
    let skippedCount = 0;

    for (const reminder of candidates) {
      const claimed = await this.tryClaimReminder(reminder.id, now);
      if (!claimed) {
        continue;
      }

      claimedCount += 1;
      reminder.status = 'PROCESSING';
      reminder.attempts_count += 1;
      reminder.last_attempt_at = now;

      if (!this.canDeliverReminder(reminder.booking)) {
        skippedCount += 1;
        await this.markReminderSkipped(
          reminder.id,
          BOOKING_REMINDER_SKIP_REASONS.BOOKING_NOT_ELIGIBLE,
        );
        continue;
      }

      if (!reminder.target_email?.trim()) {
        skippedCount += 1;
        await this.markReminderSkipped(
          reminder.id,
          BOOKING_REMINDER_SKIP_REASONS.RECIPIENT_EMAIL_MISSING,
        );
        continue;
      }

      try {
        const audience = reminder.audience;
        const recipientName =
          audience === 'CUSTOMER'
            ? reminder.booking.customer_name
            : reminder.booking.employee?.name ?? 'Profesional';

        await this.notificationsService.sendBookingReminderNotification({
          booking: reminder.booking,
          reminderId: reminder.id,
          audience,
          recipient: {
            email: reminder.target_email,
            name: recipientName,
          },
        });

        sentCount += 1;
        await this.markReminderSent(reminder.id, now);
      } catch (error) {
        failedCount += 1;
        const nextAttemptAt =
          reminder.attempts_count < maxAttempts
            ? new Date(
                now.getTime() + this.getReminderRetryDelayMinutes() * 60 * 1000,
              )
            : null;

        await this.markReminderFailed(
          reminder.id,
          String(error),
          nextAttemptAt,
        );
      }
    }

    if (claimedCount > 0) {
      this.logger.log(
        `Processed reminder batch. Claimed=${claimedCount}, sent=${sentCount}, failed=${failedCount}, skipped=${skippedCount}`,
      );
    }

    return {
      disabled: false,
      claimed_count: claimedCount,
      sent_count: sentCount,
      failed_count: failedCount,
      skipped_count: skippedCount,
    };
  }

  async recoverStuckProcessingReminders(
    now: Date = new Date(),
  ): Promise<number> {
    if (!this.isRemindersEnabled()) {
      return 0;
    }

    const staleThreshold = new Date(
      now.getTime() - this.getReminderProcessingStaleMinutes() * 60 * 1000,
    );

    const result = await this.remindersRepository
      .createQueryBuilder()
      .update(BookingReminder)
      .set({
        status: 'PENDING',
        processing_started_at: null,
        next_attempt_at: now,
        last_error: BOOKING_REMINDER_SKIP_REASONS.STALE_PROCESSING,
      })
      .where('status = :status', { status: 'PROCESSING' })
      .andWhere('processing_started_at IS NOT NULL')
      .andWhere('processing_started_at < :staleThreshold', { staleThreshold })
      .execute();

    const affected = result.affected ?? 0;
    if (affected > 0) {
      this.logger.warn(`Recovered ${affected} stuck reminder(s).`);
    }

    return affected;
  }

  private async scheduleTomorrowReminders(
    now: Date,
    kind: 'daily_dispatch' | 'backfill',
  ): Promise<ReminderSchedulingResult> {
    const timezone = this.getReminderTimezone();
    const localToday = formatDateInTimeZone(now, timezone);
    const localTomorrow = addDaysToDateString(localToday, 1);
    const tomorrowRange = getUtcRangeForLocalDate(localTomorrow, timezone);

    const bookings = await this.loadBookingsForReminderWindow(
      tomorrowRange.start,
      tomorrowRange.end,
    );

    const candidates = this.buildReminderCandidates(bookings, now);
    const existingKeys = await this.loadExistingReminderKeys(candidates);

    let scheduledCount = 0;
    for (const candidate of candidates) {
      const key = this.toReminderKey(candidate);
      if (existingKeys.has(key)) {
        continue;
      }

      const created = await this.insertReminderCandidate(candidate);
      if (created) {
        scheduledCount += 1;
        existingKeys.add(key);
      }
    }

    const skippedMissingEmailCount = bookings.reduce((count, booking) => {
      let bookingSkippedCount = 0;
      if (!booking.customer_email?.trim()) {
        bookingSkippedCount += 1;
      }
      if (!booking.employee?.email?.trim()) {
        bookingSkippedCount += 1;
      }
      return count + bookingSkippedCount;
    }, 0);

    if (scheduledCount > 0) {
      this.logger.log(
        `Scheduled ${scheduledCount} reminder(s) for ${localTomorrow} (${kind}).`,
      );
    }

    return {
      triggered: true,
      kind,
      timezone,
      local_today: localToday,
      local_tomorrow: localTomorrow,
      booking_count: bookings.length,
      candidate_count: candidates.length,
      scheduled_count: scheduledCount,
      skipped_missing_email_count: skippedMissingEmailCount,
    };
  }

  private async loadBookingsForReminderWindow(
    start: Date,
    end: Date,
  ): Promise<ReminderCandidateBooking[]> {
    return this.bookingsRepository
      .createQueryBuilder('booking')
      .leftJoinAndSelect('booking.employee', 'employee')
      .leftJoinAndSelect('booking.items', 'items')
      .where('booking.start_at_utc >= :start', { start })
      .andWhere('booking.start_at_utc < :end', { end })
      .andWhere('booking.status IN (:...statuses)', {
        statuses: [...BOOKING_REMINDER_DISPATCHABLE_BOOKING_STATUSES],
      })
      .orderBy('booking.start_at_utc', 'ASC')
      .addOrderBy('items.sort_order', 'ASC')
      .getMany() as Promise<ReminderCandidateBooking[]>;
  }

  private buildReminderCandidates(
    bookings: ReminderCandidateBooking[],
    scheduledForUtc: Date,
  ): BookingReminderDraft[] {
    const candidates: BookingReminderDraft[] = [];

    for (const booking of bookings) {
      if (booking.customer_email?.trim()) {
        candidates.push({
          tenant_id: booking.tenant_id,
          booking_id: booking.id,
          audience: 'CUSTOMER',
          channel: 'EMAIL',
          type: 'DAY_BEFORE_17H',
          target_email: booking.customer_email.trim().toLowerCase(),
          scheduled_for_utc: scheduledForUtc,
        });
      }

      if (booking.employee?.email?.trim()) {
        candidates.push({
          tenant_id: booking.tenant_id,
          booking_id: booking.id,
          audience: 'EMPLOYEE',
          channel: 'EMAIL',
          type: 'DAY_BEFORE_17H',
          target_email: booking.employee.email.trim().toLowerCase(),
          scheduled_for_utc: scheduledForUtc,
        });
      }
    }

    return candidates;
  }

  private async loadExistingReminderKeys(
    candidates: BookingReminderDraft[],
  ): Promise<Set<string>> {
    if (candidates.length === 0) {
      return new Set();
    }

    const bookingIds = [...new Set(candidates.map((candidate) => candidate.booking_id))];
    const existing = await this.remindersRepository.find({
      where: {
        booking_id: In(bookingIds),
        type: 'DAY_BEFORE_17H',
        channel: 'EMAIL',
      },
      select: {
        booking_id: true,
        audience: true,
        type: true,
        channel: true,
      },
    } as FindManyOptions<BookingReminder>);

    return new Set(
      existing.map((reminder) =>
        this.toReminderKey({
          booking_id: reminder.booking_id,
          audience: reminder.audience,
          type: reminder.type,
          channel: reminder.channel,
        }),
      ),
    );
  }

  private async insertReminderCandidate(
    candidate: BookingReminderDraft,
  ): Promise<boolean> {
    try {
      const entity = this.remindersRepository.create({
        ...candidate,
        status: 'PENDING',
        attempts_count: 0,
        last_attempt_at: null,
        next_attempt_at: null,
        processing_started_at: null,
        sent_at: null,
        last_error: null,
      });

      await this.remindersRepository.save(entity);
      return true;
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        return false;
      }

      throw error;
    }
  }

  private async loadDueReminderCandidates({
    now,
    batchSize,
    maxAttempts,
  }: LoadDueReminderOptions): Promise<BookingReminder[]> {
    return this.remindersRepository
      .createQueryBuilder('reminder')
      .leftJoinAndSelect('reminder.booking', 'booking')
      .leftJoinAndSelect('booking.employee', 'employee')
      .leftJoinAndSelect('booking.items', 'items')
      .where(
        '((reminder.status = :pendingStatus AND reminder.scheduled_for_utc <= :now) OR (reminder.status = :failedStatus AND COALESCE(reminder.next_attempt_at, reminder.scheduled_for_utc) <= :now))',
        {
          pendingStatus: 'PENDING',
          failedStatus: 'FAILED',
          now,
        },
      )
      .andWhere('reminder.attempts_count < :maxAttempts', { maxAttempts })
      .orderBy('reminder.scheduled_for_utc', 'ASC')
      .addOrderBy('reminder.created_at', 'ASC')
      .take(batchSize)
      .getMany();
  }

  private async tryClaimReminder(id: string, now: Date): Promise<boolean> {
    const result = await this.remindersRepository
      .createQueryBuilder()
      .update(BookingReminder)
      .set({
        status: 'PROCESSING',
        processing_started_at: now,
        last_attempt_at: now,
        next_attempt_at: null,
        last_error: null,
        attempts_count: () => '"attempts_count" + 1',
      })
      .where('id = :id', { id })
      .andWhere('status IN (:...statuses)', {
        statuses: ['PENDING', 'FAILED'],
      })
      .execute();

    return (result.affected ?? 0) > 0;
  }

  private async markReminderSent(id: string, now: Date): Promise<void> {
    await this.remindersRepository.update(id, {
      status: 'SENT',
      processing_started_at: null,
      sent_at: now,
      next_attempt_at: null,
      last_error: null,
    });
  }

  private async markReminderSkipped(id: string, reason: string): Promise<void> {
    await this.remindersRepository.update(id, {
      status: 'SKIPPED',
      processing_started_at: null,
      next_attempt_at: null,
      last_error: reason,
    });
  }

  private async markReminderFailed(
    id: string,
    error: string,
    nextAttemptAt: Date | null,
  ): Promise<void> {
    await this.remindersRepository.update(id, {
      status: 'FAILED',
      processing_started_at: null,
      next_attempt_at: nextAttemptAt,
      last_error: error.slice(0, 2000),
    });
  }

  private canDeliverReminder(booking: Booking | null | undefined): boolean {
    if (!booking) {
      return false;
    }

    return BOOKING_REMINDER_DISPATCHABLE_BOOKING_STATUSES.includes(
      booking.status as (typeof BOOKING_REMINDER_DISPATCHABLE_BOOKING_STATUSES)[number],
    );
  }

  private isDailyDispatchDue(now: Date, timeZone: string): boolean {
    const localParts = this.getLocalDateTimeParts(now, timeZone);
    return (
      localParts.hour === this.getReminderDispatchHour() &&
      localParts.minute === this.getReminderDispatchMinute()
    );
  }

  private isAfterDailyCutoff(now: Date, timeZone: string): boolean {
    const localParts = this.getLocalDateTimeParts(now, timeZone);
    const currentMinutes = localParts.hour * 60 + localParts.minute;
    const cutoffMinutes =
      this.getReminderDispatchHour() * 60 + this.getReminderDispatchMinute();
    return currentMinutes >= cutoffMinutes;
  }

  private getLocalDateTimeParts(
    now: Date,
    timeZone: string,
  ): { hour: number; minute: number } {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });

    const parts = formatter.formatToParts(now);
    const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));

    return {
      hour: Number(map.hour),
      minute: Number(map.minute),
    };
  }

  private isRemindersEnabled(): boolean {
    return this.configService.get<boolean>('REMINDERS_ENABLED', false);
  }

  private getReminderTimezone(): string {
    return this.configService.get<string>('REMINDERS_TIMEZONE', 'America/Caracas');
  }

  private getReminderDispatchHour(): number {
    return this.configService.get<number>('REMINDERS_DISPATCH_HOUR', 17);
  }

  private getReminderDispatchMinute(): number {
    return this.configService.get<number>('REMINDERS_DISPATCH_MINUTE', 0);
  }

  private getReminderBatchSize(): number {
    return this.configService.get<number>('REMINDERS_BATCH_SIZE', 25);
  }

  private getReminderMaxAttempts(): number {
    return this.configService.get<number>('REMINDERS_MAX_ATTEMPTS', 3);
  }

  private getReminderRetryDelayMinutes(): number {
    return this.configService.get<number>('REMINDERS_RETRY_DELAY_MINUTES', 15);
  }

  private getReminderProcessingStaleMinutes(): number {
    return this.configService.get<number>(
      'REMINDERS_PROCESSING_STALE_MINUTES',
      10,
    );
  }

  private toReminderKey(input: {
    booking_id: string;
    audience: BookingReminderAudience;
    type: string;
    channel: string;
  }): string {
    return `${input.booking_id}:${input.audience}:${input.type}:${input.channel}`;
  }

  private isUniqueConstraintError(error: unknown): boolean {
    if (!error || typeof error !== 'object') {
      return false;
    }

    const candidate = error as { code?: string; driverError?: { code?: string } };
    return (
      candidate.code === '23505' || candidate.driverError?.code === '23505'
    );
  }
}
