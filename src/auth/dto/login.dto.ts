import {
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class LoginDto {
  @IsEmail()
  @MaxLength(255)
  email: string;

  @IsString()
  @MinLength(1)
  @MaxLength(255)
  password: string;

  @IsOptional()
  @IsString()
  @MaxLength(4096)
  captcha_token?: string;
}
