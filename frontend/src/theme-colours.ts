import type { ThemePreset } from './contracts';
import { getThemeMode } from './theme-presets';

export type ThemeColourMode = 'light' | 'dark';

export const defaultThemeColour = '#0F766E';
// Legacy aliases remain available while stored preferences migrate to a single base colour.
export const defaultLightThemeColour = defaultThemeColour;
export const defaultDarkThemeColour = '#2DD4BF';

export const themeColourOptions = [
  { label: 'Teal', colour: '#0F766E' },
  { label: 'Blue', colour: '#2563EB' },
  { label: 'Purple', colour: '#7C3AED' },
  { label: 'Rose', colour: '#BE123C' },
  { label: 'Orange', colour: '#C2410C' },
  { label: 'Indigo', colour: '#4338CA' },
  { label: 'Lime', colour: '#4D7C0F' },
  { label: 'Pink', colour: '#9D174D' },
] as const;

export function resolveThemeBaseColour(value: string | null | undefined): string {
  return value && /^#[0-9A-Fa-f]{6}$/.test(value) ? value.toUpperCase() : defaultThemeColour;
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

export function getThemeColourForMode(value: string | null | undefined, mode: ThemeColourMode): string {
  const base = resolveThemeBaseColour(value);
  return mode === 'light' ? base : mixHex(base, '#FFFFFF', 0.68);
}

export function resolveThemeColour(value: string | null | undefined, mode: ThemeColourMode): string {
  return getThemeColourForMode(value, mode);
}

export function applyThemeColours(
  preset: ThemePreset,
  themeColour: string | null | undefined,
): ThemePreset {
  const mode = getThemeMode(preset);
  const primary = getThemeColourForMode(themeColour, mode);
  const colours = preset.name === 'adaptive'
    ? getThemePresetColours(mode)
    : preset.tokens.colors;
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

function getThemePresetColours(mode: ThemeColourMode) {
  return mode === 'light'
    ? {
      background: '#f8fafc', foreground: '#0f172a', card: '#ffffff', cardForeground: '#0f172a',
      surface: '#ffffff', surfaceForeground: '#0f172a', popover: '#ffffff', popoverForeground: '#0f172a',
      primary: '#0f766e', primaryForeground: '#f0fdfa', secondary: '#f1f5f9', secondaryForeground: '#1e293b',
      muted: '#f1f5f9', mutedForeground: '#64748b', accent: '#f1f5f9', accentForeground: '#0f766e',
      border: '#dbe4e2', input: '#dbe4e2', ring: '#14b8a6', destructive: '#b91c1c', destructiveForeground: '#fff1f2',
    }
    : {
      background: '#0b1111', foreground: '#e6fffb', card: '#111c1b', cardForeground: '#e6fffb',
      surface: '#111c1b', surfaceForeground: '#e6fffb', popover: '#111c1b', popoverForeground: '#e6fffb',
      primary: '#2dd4bf', primaryForeground: '#042f2e', secondary: '#192523', secondaryForeground: '#d1fae5',
      muted: '#182321', mutedForeground: '#9db2ae', accent: '#1c2e2b', accentForeground: '#5eead4',
      border: '#2a3b38', input: '#2a3b38', ring: '#2dd4bf', destructive: '#f87171', destructiveForeground: '#2b0b0b',
    };
}
