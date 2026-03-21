import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { BOOKING_SOURCES, BOOKING_STATUSES } from '../../bookings/bookings.constants';

export const REPORT_GROUP_BY_VALUES = ['day', 'week', 'month'] as const;
export type ReportGroupBy = (typeof REPORT_GROUP_BY_VALUES)[number];

function toOptionalTrimmedString(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export class ReportsOverviewQueryDto {
  @IsOptional()
  @Transform(({ value }) => toOptionalTrimmedString(value))
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date_from?: string;

  @IsOptional()
  @Transform(({ value }) => toOptionalTrimmedString(value))
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date_to?: string;

  @IsOptional()
  @Transform(({ value }) => toOptionalTrimmedString(value))
  @IsString()
  timezone?: string;

  @IsOptional()
  @Transform(({ value }) => toOptionalTrimmedString(value))
  @IsIn(REPORT_GROUP_BY_VALUES)
  group_by?: ReportGroupBy;

  @IsOptional()
  @Transform(({ value }) => toOptionalTrimmedString(value))
  @IsUUID('4')
  tenant_id?: string;

  @IsOptional()
  @Transform(({ value }) => toOptionalTrimmedString(value))
  @IsUUID('4')
  employee_id?: string;

  @IsOptional()
  @Transform(({ value }) => toOptionalTrimmedString(value))
  @IsUUID('4')
  service_id?: string;

  @IsOptional()
  @Transform(({ value }) => toOptionalTrimmedString(value))
  @IsIn(BOOKING_SOURCES)
  source?: (typeof BOOKING_SOURCES)[number];

  @IsOptional()
  @Transform(({ value }) => toOptionalTrimmedString(value))
  @IsIn(BOOKING_STATUSES)
  status?: (typeof BOOKING_STATUSES)[number];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(3)
  @Max(30)
  top_limit?: number;
}
