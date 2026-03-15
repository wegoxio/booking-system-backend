export enum TenantSettingsAssetType {
  LOGO = 'logo',
  FAVICON = 'favicon',
}

export const PLATFORM_SETTINGS_SCOPE = 'WEGOX';

export const DEFAULT_THEME_SETTINGS: Record<string, string> = {
  primary: '#efc35f',
  secondary: '#e9e9ed',
  tertiary: '#5f6470',
  primaryHover: '#d6ad50',
  secondaryHover: '#ececef',
  tertiaryHover: '#4a4f5b',
  textPrimary: '#2f3543',
  textSecondary: '#2d313b',
  textTertiary: '#6f7380',
};

export const DEFAULT_THEME_MODE = 'AUTO';

export const DEFAULT_THEME_OVERRIDES: Record<string, string> = {};

export const THEME_MODE_VALUES = ['AUTO', 'ADVANCED'] as const;

export const DEFAULT_BRANDING_SETTINGS: Record<string, string> = {
  appName: 'wegox',
  windowTitle: 'Wegox Booking System',
  logoUrl: '/wegox-logo.svg',
  faviconUrl: '/favicon.ico',
};

export const THEME_SETTING_KEYS = [
  'primary',
  'secondary',
  'tertiary',
  'primaryHover',
  'secondaryHover',
  'tertiaryHover',
  'textPrimary',
  'textSecondary',
  'textTertiary',
] as const;

export const BRANDING_SETTING_KEYS = [
  'appName',
  'windowTitle',
  'logoUrl',
  'faviconUrl',
] as const;

export const ALLOWED_IMAGE_MIME_TYPES = new Set<string>([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/x-icon',
  'image/vnd.microsoft.icon',
]);

export const PLATFORM_ASSET_MAX_SIZE_BYTES: Record<TenantSettingsAssetType, number> = {
  [TenantSettingsAssetType.LOGO]: 2 * 1024 * 1024,
  [TenantSettingsAssetType.FAVICON]: 512 * 1024,
};

export const TENANT_ASSET_MAX_SIZE_BYTES: Record<TenantSettingsAssetType, number> = {
  [TenantSettingsAssetType.LOGO]: 2 * 1024 * 1024,
  [TenantSettingsAssetType.FAVICON]: 512 * 1024,
};
