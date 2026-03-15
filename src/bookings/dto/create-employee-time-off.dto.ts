import {
  IsDateString,
  IsOptional,
  IsString,
  Length,
} from 'class-validator';

export class CreateEmployeeTimeOffDto {
  @IsDateString()
  start_at_utc: string;

  @IsDateString()
  end_at_utc: string;

  @IsOptional()
  @IsString()
  @Length(0, 1000)
  reason?: string;
}
