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

export const REPORT_BOOKING_SOURCES = ['WEB', 'MANUAL'] as const;
export type ReportBookingSource = (typeof REPORT_BOOKING_SOURCES)[number];

export const REPORT_BOOKING_STATUSES = [
  'PENDING',
  'COMPLETED',
  'CANCELLED',
  'NO_SHOW',
] as const;
export type ReportBookingStatus = (typeof REPORT_BOOKING_STATUSES)[number];

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
  @IsIn(REPORT_BOOKING_SOURCES)
  source?: ReportBookingSource;

  @IsOptional()
  @Transform(({ value }) => toOptionalTrimmedString(value))
  @IsIn(REPORT_BOOKING_STATUSES)
  status?: ReportBookingStatus;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(3)
  @Max(30)
  top_limit?: number;
}
