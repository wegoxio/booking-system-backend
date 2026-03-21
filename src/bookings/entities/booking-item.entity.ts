import { BaseEntity } from '../../common/entities/base.entity';
import { Service } from '../../services/entity/service.entity';
import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  Unique,
} from 'typeorm';
import { Booking } from './booking.entity';

@Entity('booking_items')
@Unique('UQ_booking_items_booking_sort_order', ['booking_id', 'sort_order'])
export class BookingItem extends BaseEntity {
  @Index('IDX_booking_items_booking_id')
  @Column({ type: 'uuid' })
  booking_id: string;

  @ManyToOne(() => Booking, (booking) => booking.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'booking_id' })
  booking: Booking;

  @Index('IDX_booking_items_service_id')
  @Column({ type: 'uuid' })
  service_id: string;

  @ManyToOne(() => Service, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'service_id' })
  service: Service;

  @Column({ type: 'varchar', length: 120 })
  service_name_snapshot: string;

  @Column({ type: 'int' })
  duration_minutes_snapshot: number;

  @Column({ type: 'int', default: 0 })
  buffer_before_minutes_snapshot: number;

  @Column({ type: 'int', default: 0 })
  buffer_after_minutes_snapshot: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  price_snapshot: string;

  @Column({ type: 'varchar', length: 3, default: 'USD' })
  currency_snapshot: string;

  @Column({ type: 'text', nullable: true })
  instructions_snapshot: string | null;

  @Column({ type: 'int', default: 0 })
  sort_order: number;
}
