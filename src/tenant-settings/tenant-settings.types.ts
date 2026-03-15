export type TenantThemeSettings = {
  primary: string;
  secondary: string;
  tertiary: string;
  primaryHover: string;
  secondaryHover: string;
  tertiaryHover: string;
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
};

export type TenantThemeMode = 'AUTO' | 'ADVANCED';

export type TenantThemeOverrides = Record<string, string>;

export type TenantBrandingSettings = {
  appName: string;
  windowTitle: string;
  logoUrl: string;
  faviconUrl: string;
};

export type TenantSettingsResponse = {
  id: string;
  created_at: Date;
  updated_at: Date;
  tenant_id?: string | null;
  scope?: string;
  theme: TenantThemeSettings;
  themeMode: TenantThemeMode;
  themeOverrides: TenantThemeOverrides;
  branding: TenantBrandingSettings;
  logo_key: string | null;
  favicon_key: string | null;
};

export type PublicBusinessSettingsResponse = TenantSettingsResponse & {
  business: {
    id: string;
    name: string;
    slug: string;
  };
};
