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
  appBg?: string;

  @IsOptional()
  @IsString()
  @Matches(HEX_COLOR_REGEX)
  shellBg?: string;

  @IsOptional()
  @IsString()
  @Matches(HEX_COLOR_REGEX)
  sidebarBgStart?: string;

  @IsOptional()
  @IsString()
  @Matches(HEX_COLOR_REGEX)
  sidebarBgEnd?: string;

  @IsOptional()
  @IsString()
  @Matches(HEX_COLOR_REGEX)
  sidebarText?: string;

  @IsOptional()
  @IsString()
  @Matches(HEX_COLOR_REGEX)
  sidebarActiveBg?: string;

  @IsOptional()
  @IsString()
  @Matches(HEX_COLOR_REGEX)
  sidebarActiveText?: string;

  @IsOptional()
  @IsString()
  @Matches(HEX_COLOR_REGEX)
  navbarBg?: string;

  @IsOptional()
  @IsString()
  @Matches(HEX_COLOR_REGEX)
  navbarBorder?: string;

  @IsOptional()
  @IsString()
  @Matches(HEX_COLOR_REGEX)
  iconButtonBg?: string;

  @IsOptional()
  @IsString()
  @Matches(HEX_COLOR_REGEX)
  iconButtonBorder?: string;

  @IsOptional()
  @IsString()
  @Matches(HEX_COLOR_REGEX)
  iconButtonText?: string;

  @IsOptional()
  @IsString()
  @Matches(HEX_COLOR_REGEX)
  cardBg?: string;

  @IsOptional()
  @IsString()
  @Matches(HEX_COLOR_REGEX)
  cardBorder?: string;

  @IsOptional()
  @IsString()
  @Matches(HEX_COLOR_REGEX)
  textPrimary?: string;

  @IsOptional()
  @IsString()
  @Matches(HEX_COLOR_REGEX)
  textMuted?: string;

  @IsOptional()
  @IsString()
  @Matches(HEX_COLOR_REGEX)
  primaryAccent?: string;

  @IsOptional()
  @IsString()
  @Matches(HEX_COLOR_REGEX)
  primaryAccentText?: string;
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
