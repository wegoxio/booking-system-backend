import {
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  Length,
} from 'class-validator';

export class UpdateTenantAdminDto {
  @IsOptional()
  @IsString()
  @Length(1, 120)
  name?: string;

  @IsOptional()
  @IsEmail()
  @Length(5, 255)
  email?: string;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
