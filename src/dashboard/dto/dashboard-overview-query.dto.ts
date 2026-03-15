import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class DashboardOverviewQueryDto {
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

