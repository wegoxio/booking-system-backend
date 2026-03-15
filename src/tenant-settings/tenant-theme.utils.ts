import { DEFAULT_THEME_SETTINGS } from './tenant-settings.constants';
import { TenantThemeSettings } from './tenant-settings.types';

type ThemeInput = Record<string, string> | null | undefined;

const HEX_COLOR_REGEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

function expandHex(value: string): string {
  const normalized = value.trim();
  if (!HEX_COLOR_REGEX.test(normalized)) {
    return '#000000';
  }

  if (normalized.length === 4) {
    return `#${normalized[1]}${normalized[1]}${normalized[2]}${normalized[2]}${normalized[3]}${normalized[3]}`;
  }

  return normalized.toLowerCase();
}

function getColor(input: ThemeInput, keys: string[], fallback: string): string {
  if (!input) {
    return expandHex(fallback);
  }

  for (const key of keys) {
    const value = input[key];
    if (
      typeof value === 'string' &&
      value.trim().length > 0 &&
      HEX_COLOR_REGEX.test(value.trim())
    ) {
      return expandHex(value);
    }
  }

  return expandHex(fallback);
}

function hexToRgb(value: string) {
  const hex = expandHex(value);
  return {
    r: Number.parseInt(hex.slice(1, 3), 16),
    g: Number.parseInt(hex.slice(3, 5), 16),
    b: Number.parseInt(hex.slice(5, 7), 16),
  };
}

function rgbToHex(r: number, g: number, b: number) {
  const channelToHex = (channel: number) =>
    Math.max(0, Math.min(255, Math.round(channel)))
      .toString(16)
      .padStart(2, '0');

  return `#${channelToHex(r)}${channelToHex(g)}${channelToHex(b)}`;
}

function mixHex(base: string, target: string, weight: number) {
  const from = hexToRgb(base);
  const to = hexToRgb(target);
  return rgbToHex(
    from.r + (to.r - from.r) * weight,
    from.g + (to.g - from.g) * weight,
    from.b + (to.b - from.b) * weight,
  );
}

function lightenHex(value: string, amount: number) {
  return mixHex(value, '#ffffff', amount);
}

function darkenHex(value: string, amount: number) {
  return mixHex(value, '#000000', amount);
}

export function normalizeThemeSettings(theme: ThemeInput): TenantThemeSettings {
  const primary = getColor(
    theme,
    ['primary', 'primaryAccent'],
    DEFAULT_THEME_SETTINGS.primary,
  );
  const secondary = getColor(
    theme,
    ['secondary', 'cardBg', 'shellBg', 'navbarBg'],
    DEFAULT_THEME_SETTINGS.secondary,
  );
  const tertiary = getColor(
    theme,
    ['tertiary', 'sidebarBgStart', 'appBg'],
    DEFAULT_THEME_SETTINGS.tertiary,
  );
  const textPrimary = getColor(
    theme,
    ['textPrimary', 'textBody', 'primaryAccentText', 'textSecondary'],
    DEFAULT_THEME_SETTINGS.textPrimary,
  );
  const textSecondary = getColor(
    theme,
    ['textSecondary', 'textMuted', 'textTertiary', 'iconButtonText', 'textPrimary'],
    DEFAULT_THEME_SETTINGS.textSecondary,
  );

  return {
    primary,
    secondary,
    tertiary,
    primaryHover: darkenHex(primary, 0.12),
    secondaryHover: lightenHex(secondary, 0.14),
    tertiaryHover: darkenHex(tertiary, 0.16),
    textPrimary,
    textSecondary,
    textTertiary: mixHex(textSecondary, secondary, 0.35),
  };
}
