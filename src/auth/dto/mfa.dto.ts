import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CompleteMfaLoginDto {
  @IsString()
  @MinLength(20)
  @MaxLength(4096)
  challenge_token: string;

  @IsOptional()
  @IsString()
  @MinLength(6)
  @MaxLength(32)
  code?: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(64)
  recovery_code?: string;
}

export class VerifyMfaCodeDto {
  @IsOptional()
  @IsString()
  @MinLength(6)
  @MaxLength(32)
  code?: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(64)
  recovery_code?: string;
}
