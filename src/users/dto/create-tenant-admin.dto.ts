import {
  IsEmail,
  IsNotEmpty,
  IsString,
  IsStrongPassword,
  IsUUID,
  Length,
} from 'class-validator';

export class CreateTenantAdminDto {
  @IsString()
  @IsNotEmpty()
  @Length(1, 120)
  name: string;

  @IsEmail()
  @Length(5, 255)
  email: string;

  @IsStrongPassword()
  password: string;

  @IsUUID()
  tenant_id: string;
}
