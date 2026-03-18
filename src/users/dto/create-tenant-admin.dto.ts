import {
  IsEmail,
  IsNotEmpty,
  IsString,
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

  @IsUUID()
  tenant_id: string;
}
