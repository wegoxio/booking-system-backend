import { IsISO8601, IsOptional, IsString, Length } from 'class-validator';

export class RescheduleBookingDto {
  @IsISO8601()
  start_at_utc!: string;

  @IsOptional()
  @IsString()
  @Length(1, 64)
  timezone?: string;
}
