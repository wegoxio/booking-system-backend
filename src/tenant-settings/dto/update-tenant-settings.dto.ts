import { Type } from 'class-transformer';
import {
  IsOptional,
  IsString,
  Length,
  Matches,
  ValidateNested,
} from 'class-validator';

const HEX_COLOR_REGEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

class ThemeSettingsDto {
  @IsOptional()
  @IsString()
  @Matches(HEX_COLOR_REGEX)
  primary?: string;

  @IsOptional()
  @IsString()
  @Matches(HEX_COLOR_REGEX)
  secondary?: string;

  @IsOptional()
  @IsString()
  @Matches(HEX_COLOR_REGEX)
  tertiary?: string;

  @IsOptional()
  @IsString()
  @Matches(HEX_COLOR_REGEX)
  primaryHover?: string;

  @IsOptional()
  @IsString()
  @Matches(HEX_COLOR_REGEX)
  secondaryHover?: string;

  @IsOptional()
  @IsString()
  @Matches(HEX_COLOR_REGEX)
  tertiaryHover?: string;

  @IsOptional()
  @IsString()
  @Matches(HEX_COLOR_REGEX)
  textPrimary?: string;

  @IsOptional()
  @IsString()
  @Matches(HEX_COLOR_REGEX)
  textSecondary?: string;

  @IsOptional()
  @IsString()
  @Matches(HEX_COLOR_REGEX)
  textTertiary?: string;
}

class BrandingSettingsDto {
  @IsOptional()
  @IsString()
  @Length(1, 120)
  appName?: string;

  @IsOptional()
  @IsString()
  @Length(1, 160)
  windowTitle?: string;

  @IsOptional()
  @IsString()
  @Length(1, 2048)
  logoUrl?: string;

  @IsOptional()
  @IsString()
  @Length(1, 2048)
  faviconUrl?: string;
}

export class UpdateTenantSettingsDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => ThemeSettingsDto)
  theme?: ThemeSettingsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => BrandingSettingsDto)
  branding?: BrandingSettingsDto;
}
