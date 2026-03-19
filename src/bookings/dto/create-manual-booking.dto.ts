import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
} from 'class-validator';
import { BOOKING_STATUSES } from '../bookings.constants';

export class CreateManualBookingDto {
  @IsUUID('4')
  employee_id: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  service_ids: string[];

  @IsDateString()
  start_at_utc: string;

  @IsString()
  @Length(1, 120)
  customer_name: string;

  @IsOptional()
  @IsEmail()
  @Length(5, 255)
  customer_email?: string;

  @IsOptional()
  @IsString()
  @Length(3, 30)
  customer_phone?: string;

  @IsOptional()
  @IsString()
  @Length(2, 2)
  @Matches(/^[A-Za-z]{2}$/)
  customer_phone_country_iso2?: string | null;

  @IsOptional()
  @IsString()
  @Length(4, 20)
  customer_phone_national_number?: string | null;

  @IsOptional()
  @IsString()
  @Length(0, 2000)
  notes?: string;

  @IsOptional()
  @IsString()
  @IsIn(BOOKING_STATUSES)
  status?: (typeof BOOKING_STATUSES)[number];

  @IsOptional()
  @IsString()
  @Length(1, 500)
  cancellation_reason?: string;

  @IsOptional()
  @IsBoolean()
  allow_overlap?: boolean = false;
}
