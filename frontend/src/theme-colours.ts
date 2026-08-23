import type { ThemePreset } from './contracts';
import { getThemeMode } from './theme-presets';

export type ThemeColourMode = 'light' | 'dark';

export const defaultLightThemeColour = '#0F766E';
export const defaultDarkThemeColour = '#2DD4BF';

export const themeColourOptions = [
  { label: 'Teal', light: '#0F766E', dark: '#2DD4BF' },
  { label: 'Blue', light: '#2563EB', dark: '#60A5FA' },
  { label: 'Purple', light: '#7C3AED', dark: '#A78BFA' },
  { label: 'Rose', light: '#BE123C', dark: '#FB7185' },
  { label: 'Orange', light: '#C2410C', dark: '#FB923C' },
  { label: 'Indigo', light: '#4338CA', dark: '#818CF8' },
  { label: 'Lime', light: '#4D7C0F', dark: '#A3E635' },
  { label: 'Pink', light: '#9D174D', dark: '#F472B6' },
] as const;

export function resolveThemeColour(value: string | null | undefined, mode: ThemeColourMode): string {
  const fallback = mode === 'light' ? defaultLightThemeColour : defaultDarkThemeColour;
  return value && /^#[0-9A-Fa-f]{6}$/.test(value) ? value.toUpperCase() : fallback;
}

function hexToRgb(hex: string): [number, number, number] {
  return [1, 3, 5].map((index) => Number.parseInt(hex.slice(index, index + 2), 16)) as [number, number, number];
}

function rgbToHex(rgb: [number, number, number]): string {
  return `#${rgb.map((channel) => Math.round(channel).toString(16).padStart(2, '0')).join('')}`.toUpperCase();
}

function mixHex(first: string, second: string, firstWeight: number): string {
  const firstRgb = hexToRgb(first);
  const secondRgb = hexToRgb(second);
  return rgbToHex(firstRgb.map((channel, index) => channel * firstWeight + secondRgb[index] * (1 - firstWeight)) as [number, number, number]);
}

function relativeLuminance(hex: string): number {
  return hexToRgb(hex).reduce((total, channel, index) => {
    const normalized = channel / 255;
    const linear = normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
    return total + linear * [0.2126, 0.7152, 0.0722][index];
  }, 0);
}

function getContrastForeground(background: string): '#000000' | '#FFFFFF' {
  const luminance = relativeLuminance(background);
  const blackContrast = (luminance + 0.05) / 0.05;
  const whiteContrast = 1.05 / (luminance + 0.05);
  return blackContrast >= whiteContrast ? '#000000' : '#FFFFFF';
}

export function applyThemeColours(
  preset: ThemePreset,
  lightThemeColour: string | null | undefined,
  darkThemeColour: string | null | undefined,
): ThemePreset {
  const mode = getThemeMode(preset);
  const primary = resolveThemeColour(mode === 'light' ? lightThemeColour : darkThemeColour, mode);
  const colours = preset.tokens.colors;
  const accent = mixHex(primary, colours.background, mode === 'light' ? 0.1 : 0.28);

  return {
    ...preset,
    tokens: {
      ...preset.tokens,
      colors: {
        ...colours,
        primary,
        primaryForeground: getContrastForeground(primary),
        accent,
        accentForeground: primary,
        ring: primary,
      },
      chartPaletteHooks: [primary, mixHex(primary, colours.foreground, 0.65), colours.mutedForeground],
    },
  };
}
