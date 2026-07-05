import { IsISO8601, IsOptional, IsString, MaxLength } from 'class-validator';

export class ReschedulePublicBookingDto {
  @IsISO8601()
  start_at_utc: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  timezone?: string;

  @IsOptional()
  @IsString()
  captcha_token?: string;
}
