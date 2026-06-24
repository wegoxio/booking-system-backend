import { Type } from 'class-transformer';
import { IsInt, IsOptional, Matches, Max, Min } from 'class-validator';
import { Transform } from 'class-transformer';

export class DashboardOverviewQueryDto {
  @IsOptional()
  @Transform(({ value }) => String(value).trim().toUpperCase())
  @Matches(/^[A-Z]{3}$/)
  currency?: string;
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(3)
  @Max(12)
  months?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(3)
  @Max(20)
  logs_limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(5)
  @Max(30)
  table_limit?: number;
}
