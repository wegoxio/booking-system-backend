export enum TenantSettingsAssetType {
  LOGO = 'logo',
  FAVICON = 'favicon',
}

export const PLATFORM_SETTINGS_SCOPE = 'WEGOX';

export const DEFAULT_THEME_SETTINGS: Record<string, string> = {
  appBg: '#d6d6db',
  shellBg: '#e9e9ed',
  sidebarBgStart: '#5f6470',
  sidebarBgEnd: '#4a4f5b',
  sidebarText: '#ffffff',
  sidebarActiveBg: '#efc35f',
  sidebarActiveText: '#353a46',
  navbarBg: '#ececef',
  navbarBorder: '#e5e6eb',
  iconButtonBg: '#ffffff',
  iconButtonBorder: '#d8dae1',
  iconButtonText: '#686d79',
  cardBg: '#fafafc',
  cardBorder: '#e4e4e8',
  textPrimary: '#2d313b',
  textMuted: '#6f7380',
  primaryAccent: '#efc35f',
  primaryAccentText: '#2f3543',
};

export const DEFAULT_BRANDING_SETTINGS: Record<string, string> = {
  appName: 'wegox',
  windowTitle: 'Wegox Booking System',
  logoUrl: '/wegox-logo.svg',
  faviconUrl: '/favicon.ico',
};

export const ALLOWED_IMAGE_MIME_TYPES = new Set<string>([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/svg+xml',
  'image/x-icon',
  'image/vnd.microsoft.icon',
]);
