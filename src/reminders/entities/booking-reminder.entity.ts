import { Booking } from '../../bookings/entities/booking.entity';
import { TenantBaseEntity } from '../../common/entities/tenant-base-entity';
import { Tenant } from '../../tenant/entities/tenant.entity';
import type {
  BookingReminderAudience,
  BookingReminderChannel,
  BookingReminderStatus,
  BookingReminderType,
} from '../reminders.constants';
import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  Unique,
} from 'typeorm';

@Entity('booking_reminders')
@Unique('UQ_booking_reminders_delivery', [
  'booking_id',
  'audience',
  'type',
  'channel',
])
@Index('IDX_booking_reminders_booking_id', ['booking_id'])
@Index('IDX_booking_reminders_tenant_id', ['tenant_id'])
@Index('IDX_booking_reminders_status_scheduled_for', ['status', 'scheduled_for_utc'])
@Index('IDX_booking_reminders_status_next_attempt', ['status', 'next_attempt_at'])
export class BookingReminder extends TenantBaseEntity {
  @Column({ type: 'uuid' })
  booking_id: string;

  @ManyToOne(() => Booking, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'booking_id' })
  booking: Booking;

  @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant;

  @Column({ type: 'varchar', length: 20 })
  audience: BookingReminderAudience;

  @Column({ type: 'varchar', length: 20, default: 'EMAIL' })
  channel: BookingReminderChannel;

  @Column({ type: 'varchar', length: 40 })
  type: BookingReminderType;

  @Column({ type: 'varchar', length: 20, default: 'PENDING' })
  status: BookingReminderStatus;

  @Column({ type: 'varchar', length: 255 })
  target_email: string;

  @Column({ type: 'timestamptz' })
  scheduled_for_utc: Date;

  @Column({ type: 'int', default: 0 })
  attempts_count: number;

  @Column({ type: 'timestamptz', nullable: true })
  last_attempt_at: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  next_attempt_at: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  processing_started_at: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  sent_at: Date | null;

  @Column({ type: 'text', nullable: true })
  last_error: string | null;
}
