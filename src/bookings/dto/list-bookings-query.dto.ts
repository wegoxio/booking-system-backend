import { IsIn, IsOptional, IsUUID, Matches } from 'class-validator';
import { BOOKING_STATUSES } from '../bookings.constants';

export class ListBookingsQueryDto {
  @IsOptional()
  @IsUUID('4')
  employee_id?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date?: string;

  @IsOptional()
  @IsIn(BOOKING_STATUSES)
  status?: (typeof BOOKING_STATUSES)[number];
}
