import { IsNotEmpty, IsString, IsStrongPassword, Length } from 'class-validator';

export class CompletePasswordResetDto {
  @IsString()
  @IsNotEmpty()
  @Length(20, 500)
  token: string;

  @IsStrongPassword()
  password: string;
}
