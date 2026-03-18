import {
  IsNotEmpty,
  IsString,
  IsStrongPassword,
  Length,
} from 'class-validator';

export class CompleteTenantAdminOnboardingDto {
  @IsString()
  @IsNotEmpty()
  @Length(20, 500)
  token: string;

  @IsString()
  @IsNotEmpty()
  @Length(1, 120)
  name: string;

  @IsStrongPassword()
  password: string;
}
