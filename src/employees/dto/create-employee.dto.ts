import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Matches,
} from 'class-validator';

export class CreateEmployeeDto {
  @IsString()
  @IsNotEmpty()
  @Length(1, 120)
  name: string;

  @IsEmail()
  @Length(5, 255)
  email: string;

  @IsOptional()
  @IsString()
  @Length(3, 30)
  phone?: string;

  @IsOptional()
  @IsString()
  @Length(2, 2)
  @Matches(/^[A-Za-z]{2}$/)
  phone_country_iso2?: string | null;

  @IsOptional()
  @IsString()
  @Length(4, 20)
  phone_national_number?: string | null;
}
