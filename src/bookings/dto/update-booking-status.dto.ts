import { IsIn, IsOptional, IsString, Length } from 'class-validator';
import { BOOKING_STATUSES } from '../bookings.constants';

export class UpdateBookingStatusDto {
  @IsIn(BOOKING_STATUSES)
  status: (typeof BOOKING_STATUSES)[number];

  @IsOptional()
  @IsString()
  @Length(1, 500)
  cancellation_reason?: string;
}
