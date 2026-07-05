import { IsOptional, IsString, Length, Matches } from 'class-validator';

export class PublicBookingManagementAvailabilityQueryDto {
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date: string;

  @IsOptional()
  @IsString()
  @Length(2, 64)
  timezone?: string;
}
