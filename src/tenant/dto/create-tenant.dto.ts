import { IsNotEmpty, IsString, Length, Matches } from 'class-validator';

export class CreateTenantDto {
  @IsString()
  @IsNotEmpty()
  @Length(1, 120)
  name: string;

  @IsString()
  @IsNotEmpty()
  @Length(3, 60)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message:
      'Slug invalido. Usa minusculas, numeros y guiones (sin espacios).',
  })
  slug: string;
}
