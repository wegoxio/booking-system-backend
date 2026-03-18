import { IsNotEmpty, IsString, Length } from 'class-validator';

export class ResolvePasswordResetDto {
  @IsString()
  @IsNotEmpty()
  @Length(20, 500)
  token: string;
}
