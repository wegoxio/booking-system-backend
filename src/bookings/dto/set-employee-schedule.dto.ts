import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

const LOCAL_TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

export class ScheduleIntervalDto {
  @IsInt()
  @Min(0)
  @Max(6)
  day_of_week: number;

  @Matches(LOCAL_TIME_REGEX, {
    message: 'start_time_local must be in HH:mm format',
  })
  start_time_local: string;

  @Matches(LOCAL_TIME_REGEX, {
    message: 'end_time_local must be in HH:mm format',
  })
  end_time_local: string;
}

export class SetEmployeeScheduleDto {
  @IsOptional()
  @IsString()
  @Length(2, 64)
  schedule_timezone?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ScheduleIntervalDto)
  working_hours: ScheduleIntervalDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ScheduleIntervalDto)
  breaks?: ScheduleIntervalDto[];
}
