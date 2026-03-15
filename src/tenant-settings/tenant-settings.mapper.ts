import { PlatformSetting } from './entities/platform-setting.entity';
import { TenantSetting } from './entities/tenant-setting.entity';
import {
  DEFAULT_BRANDING_SETTINGS,
  DEFAULT_THEME_MODE,
  DEFAULT_THEME_OVERRIDES,
  DEFAULT_THEME_SETTINGS,
  THEME_MODE_VALUES,
} from './tenant-settings.constants';
import {
  TenantBrandingSettings,
  TenantSettingsResponse,
  TenantThemeMode,
  TenantThemeOverrides,
  TenantThemeSettings,
} from './tenant-settings.types';

type SettingsEntity = PlatformSetting | TenantSetting;

export function extractThemeSettings(entity: SettingsEntity): TenantThemeSettings {
  return {
    primary: entity.primary_color ?? DEFAULT_THEME_SETTINGS.primary,
    secondary: entity.secondary_color ?? DEFAULT_THEME_SETTINGS.secondary,
    tertiary: entity.tertiary_color ?? DEFAULT_THEME_SETTINGS.tertiary,
    primaryHover:
      entity.primary_hover_color ?? DEFAULT_THEME_SETTINGS.primaryHover,
    secondaryHover:
      entity.secondary_hover_color ?? DEFAULT_THEME_SETTINGS.secondaryHover,
    tertiaryHover:
      entity.tertiary_hover_color ?? DEFAULT_THEME_SETTINGS.tertiaryHover,
    textPrimary:
      entity.text_primary_color ?? DEFAULT_THEME_SETTINGS.textPrimary,
    textSecondary:
      entity.text_secondary_color ?? DEFAULT_THEME_SETTINGS.textSecondary,
    textTertiary:
      entity.text_tertiary_color ?? DEFAULT_THEME_SETTINGS.textTertiary,
  };
}

export function extractBrandingSettings(
  entity: SettingsEntity,
): TenantBrandingSettings {
  return {
    appName: entity.app_name ?? DEFAULT_BRANDING_SETTINGS.appName,
    windowTitle: entity.window_title ?? DEFAULT_BRANDING_SETTINGS.windowTitle,
    logoUrl: entity.logo_url ?? DEFAULT_BRANDING_SETTINGS.logoUrl,
    faviconUrl: entity.favicon_url ?? DEFAULT_BRANDING_SETTINGS.faviconUrl,
  };
}

export function extractThemeMode(entity: SettingsEntity): TenantThemeMode {
  const mode = entity.theme_mode;
  if (mode && THEME_MODE_VALUES.includes(mode as TenantThemeMode)) {
    return mode as TenantThemeMode;
  }
  return DEFAULT_THEME_MODE as TenantThemeMode;
}

export function extractThemeOverrides(
  entity: SettingsEntity,
): TenantThemeOverrides {
  const input = entity.theme_overrides;
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { ...DEFAULT_THEME_OVERRIDES };
  }

  const normalizedEntries = Object.entries(input).filter(
    ([key, value]) => key.trim().length > 0 && typeof value === 'string',
  );

  return Object.fromEntries(normalizedEntries);
}

export function applyThemeSettings(
  entity: SettingsEntity,
  theme: Partial<TenantThemeSettings>,
) {
  if (theme.primary !== undefined) entity.primary_color = theme.primary;
  if (theme.secondary !== undefined) entity.secondary_color = theme.secondary;
  if (theme.tertiary !== undefined) entity.tertiary_color = theme.tertiary;
  if (theme.primaryHover !== undefined) {
    entity.primary_hover_color = theme.primaryHover;
  }
  if (theme.secondaryHover !== undefined) {
    entity.secondary_hover_color = theme.secondaryHover;
  }
  if (theme.tertiaryHover !== undefined) {
    entity.tertiary_hover_color = theme.tertiaryHover;
  }
  if (theme.textPrimary !== undefined) {
    entity.text_primary_color = theme.textPrimary;
  }
  if (theme.textSecondary !== undefined) {
    entity.text_secondary_color = theme.textSecondary;
  }
  if (theme.textTertiary !== undefined) {
    entity.text_tertiary_color = theme.textTertiary;
  }
}

export function applyThemeMode(entity: SettingsEntity, mode: TenantThemeMode) {
  entity.theme_mode = mode;
}

export function applyThemeOverrides(
  entity: SettingsEntity,
  overrides: TenantThemeOverrides,
) {
  const normalizedEntries = Object.entries(overrides ?? {}).filter(
    ([key, value]) => key.trim().length > 0 && typeof value === 'string',
  );
  entity.theme_overrides = Object.fromEntries(normalizedEntries);
}

export function applyBrandingSettings(
  entity: SettingsEntity,
  branding: Partial<TenantBrandingSettings>,
) {
  if (branding.appName !== undefined) entity.app_name = branding.appName;
  if (branding.windowTitle !== undefined) {
    entity.window_title = branding.windowTitle;
  }
  if (branding.logoUrl !== undefined) entity.logo_url = branding.logoUrl;
  if (branding.faviconUrl !== undefined) {
    entity.favicon_url = branding.faviconUrl;
  }
}

export function applyDefaultSettings(entity: SettingsEntity) {
  applyThemeSettings(entity, DEFAULT_THEME_SETTINGS);
  applyThemeMode(entity, DEFAULT_THEME_MODE as TenantThemeMode);
  applyThemeOverrides(entity, DEFAULT_THEME_OVERRIDES);
  applyBrandingSettings(entity, DEFAULT_BRANDING_SETTINGS);
}

export function ensureSettingsDefaults(entity: SettingsEntity) {
  if (!entity.primary_color) entity.primary_color = DEFAULT_THEME_SETTINGS.primary;
  if (!entity.secondary_color) {
    entity.secondary_color = DEFAULT_THEME_SETTINGS.secondary;
  }
  if (!entity.tertiary_color) entity.tertiary_color = DEFAULT_THEME_SETTINGS.tertiary;
  if (!entity.primary_hover_color) {
    entity.primary_hover_color = DEFAULT_THEME_SETTINGS.primaryHover;
  }
  if (!entity.secondary_hover_color) {
    entity.secondary_hover_color = DEFAULT_THEME_SETTINGS.secondaryHover;
  }
  if (!entity.tertiary_hover_color) {
    entity.tertiary_hover_color = DEFAULT_THEME_SETTINGS.tertiaryHover;
  }
  if (!entity.text_primary_color) {
    entity.text_primary_color = DEFAULT_THEME_SETTINGS.textPrimary;
  }
  if (!entity.text_secondary_color) {
    entity.text_secondary_color = DEFAULT_THEME_SETTINGS.textSecondary;
  }
  if (!entity.text_tertiary_color) {
    entity.text_tertiary_color = DEFAULT_THEME_SETTINGS.textTertiary;
  }
  if (!entity.theme_mode) {
    entity.theme_mode = DEFAULT_THEME_MODE;
  }
  if (
    !entity.theme_overrides ||
    typeof entity.theme_overrides !== 'object' ||
    Array.isArray(entity.theme_overrides)
  ) {
    entity.theme_overrides = { ...DEFAULT_THEME_OVERRIDES };
  }
  if (!entity.app_name) entity.app_name = DEFAULT_BRANDING_SETTINGS.appName;
  if (!entity.window_title) {
    entity.window_title = DEFAULT_BRANDING_SETTINGS.windowTitle;
  }
  if (!entity.logo_url) entity.logo_url = DEFAULT_BRANDING_SETTINGS.logoUrl;
  if (!entity.favicon_url) {
    entity.favicon_url = DEFAULT_BRANDING_SETTINGS.faviconUrl;
  }
}

export function serializeSettings(
  entity: SettingsEntity,
): TenantSettingsResponse {
  return {
    id: entity.id,
    created_at: entity.created_at,
    updated_at: entity.updated_at,
    tenant_id: 'tenant_id' in entity ? entity.tenant_id : null,
    scope: 'scope' in entity ? entity.scope : undefined,
    theme: extractThemeSettings(entity),
    themeMode: extractThemeMode(entity),
    themeOverrides: extractThemeOverrides(entity),
    branding: extractBrandingSettings(entity),
    logo_key: entity.logo_key,
    favicon_key: entity.favicon_key,
  };
}
