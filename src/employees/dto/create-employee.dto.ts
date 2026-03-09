import { IsEmail, IsNotEmpty, IsOptional, IsString, Length } from 'class-validator';

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
}
