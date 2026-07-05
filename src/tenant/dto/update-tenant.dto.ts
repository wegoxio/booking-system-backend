import { PartialType } from '@nestjs/mapped-types';
import {
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { CreateTenantDto } from './create-tenant.dto';

export class UpdateTenantDto extends PartialType(CreateTenantDto) {
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  @Matches(/^[\p{L}\p{N}\s.,#º°\-'/]+$/u, {
    message: 'La dirección contiene caracteres no permitidos.',
  })
  address_line?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  @Matches(/^[\p{L}\s.'-]+$/u, {
    message: 'La ciudad contiene caracteres no permitidos.',
  })
  city?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  @Matches(/^[\p{L}\s.'-]+$/u, {
    message: 'El estado contiene caracteres no permitidos.',
  })
  state?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  @Matches(/^[\p{L}\s.'-]+$/u, {
    message: 'El país contiene caracteres no permitidos.',
  })
  country?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  @Matches(/^[A-Za-z0-9\-\s]+$/, {
    message: 'El código postal contiene caracteres no permitidos.',
  })
  postal_code?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  @Matches(/^\+\d{1,4}\s?\d{4,15}$/, {
    message: 'El teléfono debe incluir prefijo internacional y número.',
  })
  phone?: string;

  @IsOptional()
  @ValidateIf((_, value) => value !== '')
  @IsEmail()
  @MaxLength(255)
  public_email?: string;
}
