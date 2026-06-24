import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsInt,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Length,
  Matches,
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

  @IsOptional()
  @IsString()
  @Length(0, 2000)
  instructions?: string;

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
  @Max(100)
  capacity?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  min_capacity?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  max_capacity?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  min_party_size?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  max_party_size?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  slot_capacity?: number;

  @IsOptional()
  @IsString()
  @IsIn(['FLAT', 'PER_PERSON'])
  pricing_model?: 'FLAT' | 'PER_PERSON';

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  price: number;

  @IsOptional()
  @IsString()
  @Length(3, 3)
  @Matches(/^[A-Za-z]{3}$/)
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

  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  employee_ids: string[];
}
