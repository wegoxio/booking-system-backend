import { IsIn } from 'class-validator';
import { BOOKING_STATUSES } from '../bookings.constants';

export class UpdateBookingStatusDto {
  @IsIn(BOOKING_STATUSES)
  status: (typeof BOOKING_STATUSES)[number];
}
