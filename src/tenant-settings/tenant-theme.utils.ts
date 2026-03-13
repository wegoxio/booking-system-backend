import { DEFAULT_THEME_SETTINGS } from './tenant-settings.constants';
import { TenantThemeSettings } from './tenant-settings.types';

type ThemeInput = Record<string, string> | null | undefined;

function getColor(input: ThemeInput, keys: string[], fallback: string): string {
  if (!input) {
    return fallback;
  }

  for (const key of keys) {
    const value = input[key];
    if (typeof value === 'string' && value.trim().length > 0) {
      return value;
    }
  }

  return fallback;
}

export function normalizeThemeSettings(theme: ThemeInput): TenantThemeSettings {
  return {
    primary: getColor(theme, ['primary', 'primaryAccent'], DEFAULT_THEME_SETTINGS.primary),
    secondary: getColor(
      theme,
      ['secondary', 'cardBg', 'shellBg', 'navbarBg'],
      DEFAULT_THEME_SETTINGS.secondary,
    ),
    tertiary: getColor(
      theme,
      ['tertiary', 'sidebarBgStart', 'appBg'],
      DEFAULT_THEME_SETTINGS.tertiary,
    ),
    primaryHover: getColor(
      theme,
      ['primaryHover', 'sidebarActiveBg', 'primaryAccent'],
      DEFAULT_THEME_SETTINGS.primaryHover,
    ),
    secondaryHover: getColor(
      theme,
      ['secondaryHover', 'navbarBg', 'iconButtonBg'],
      DEFAULT_THEME_SETTINGS.secondaryHover,
    ),
    tertiaryHover: getColor(
      theme,
      ['tertiaryHover', 'sidebarBgEnd'],
      DEFAULT_THEME_SETTINGS.tertiaryHover,
    ),
    textPrimary: getColor(
      theme,
      ['textPrimary', 'primaryAccentText'],
      DEFAULT_THEME_SETTINGS.textPrimary,
    ),
    textSecondary: getColor(
      theme,
      ['textSecondary', 'textPrimary'],
      DEFAULT_THEME_SETTINGS.textSecondary,
    ),
    textTertiary: getColor(
      theme,
      ['textTertiary', 'textMuted', 'iconButtonText'],
      DEFAULT_THEME_SETTINGS.textTertiary,
    ),
  };
}
