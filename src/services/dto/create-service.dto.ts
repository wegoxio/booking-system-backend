import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Length,
  Max,
  Min,
} from 'class-validator';

export class CreateServiceDto {
  @IsString()
  @IsNotEmpty()
  @Length(1, 120)
  name: string;

  @IsOptional()
  @IsString()
  @Length(0, 1000)
  description?: string;

  @IsInt()
  @IsPositive()
  duration_minutes: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  buffer_before_minutes?: number = 0;

  @IsOptional()
  @IsInt()
  @Min(0)
  buffer_after_minutes?: number = 0;

  @IsOptional()
  @IsInt()
  @IsPositive()
  capacity?: number = 1;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  price: number;

  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string = 'USD';

  @IsOptional()
  @IsBoolean()
  is_active?: boolean = true;

  @IsOptional()
  @IsInt()
  @Min(0)
  sort_order?: number = 0;

  @IsOptional()
  @IsBoolean()
  requires_confirmation?: boolean = false;

  @IsOptional()
  @IsInt()
  @Min(0)
  min_notice_minutes?: number = 0;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  booking_window_days?: number = 60;
}