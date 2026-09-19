import type { ThemePreset } from './contracts';
import { getThemeMode } from './theme-presets';

export type ThemeColourMode = 'light' | 'dark';
export type ThemeAccent = 'primary' | 'secondary' | 'tertiary' | 'quaternary';
export type ThemeAccentColours = Record<ThemeAccent, string>;

export const defaultThemeColours: ThemeAccentColours = {
  primary: '#0F766E',
  secondary: '#115E59',
  tertiary: '#0D9488',
  quaternary: '#14B8A6',
};
export const defaultThemeColour = defaultThemeColours.primary;
export const defaultSecondaryThemeColour = defaultThemeColours.secondary;
export const defaultTertiaryThemeColour = defaultThemeColours.tertiary;
export const defaultQuaternaryThemeColour = defaultThemeColours.quaternary;
// Legacy aliases remain available while stored preferences migrate to the accent palette.
export const defaultLightThemeColour = defaultThemeColour;
export const defaultDarkThemeColour = defaultThemeColour;

export const themeColourOptions = [
  { label: 'Teal', colour: '#0F766E' },
  { label: 'Deep teal', colour: '#115E59' },
  { label: 'Bright teal', colour: '#0D9488' },
  { label: 'Blue', colour: '#2563EB' },
  { label: 'Purple', colour: '#7C3AED' },
  { label: 'Rose', colour: '#BE123C' },
  { label: 'Orange', colour: '#C2410C' },
  { label: 'Indigo', colour: '#4338CA' },
  { label: 'Lime', colour: '#4D7C0F' },
  { label: 'Pink', colour: '#9D174D' },
] as const;

export interface ThemeColourPalette {
  name: string;
  label: string;
  colours: ThemeAccentColours;
}

export const themeColourPalettes: readonly ThemeColourPalette[] = [
  { name: 'teal', label: 'Teal', colours: defaultThemeColours },
  {
    name: 'ocean',
    label: 'Ocean',
    colours: { primary: '#2563EB', secondary: '#0891B2', tertiary: '#14B8A6', quaternary: '#4F46E5' },
  },
  {
    name: 'violet',
    label: 'Violet',
    colours: { primary: '#7C3AED', secondary: '#4F46E5', tertiary: '#C026D3', quaternary: '#DB2777' },
  },
  {
    name: 'rose',
    label: 'Rose',
    colours: { primary: '#BE123C', secondary: '#9F1239', tertiary: '#DB2777', quaternary: '#C2410C' },
  },
  {
    name: 'sunset',
    label: 'Sunset',
    colours: { primary: '#C2410C', secondary: '#B45309', tertiary: '#BE123C', quaternary: '#7C3AED' },
  },
  {
    name: 'forest',
    label: 'Forest',
    colours: { primary: '#15803D', secondary: '#4D7C0F', tertiary: '#0F766E', quaternary: '#A16207' },
  },
];

export function getThemeColourPalette(value: Partial<ThemeAccentColours> | string | null | undefined): ThemeColourPalette | null {
  const colours = resolveThemeAccentColours(value);
  return themeColourPalettes.find((palette) => (
    palette.colours.primary === colours.primary
    && palette.colours.secondary === colours.secondary
    && palette.colours.tertiary === colours.tertiary
    && palette.colours.quaternary === colours.quaternary
  )) ?? null;
}

export function resolveThemeBaseColour(value: string | null | undefined): string {
  return value && /^#[0-9A-Fa-f]{6}$/.test(value) ? value.toUpperCase() : defaultThemeColour;
}

export function resolveThemeAccentColours(
  value: Partial<ThemeAccentColours> | string | null | undefined,
): ThemeAccentColours {
  if (typeof value === 'string' || value == null) {
    return {
      ...defaultThemeColours,
      primary: resolveThemeBaseColour(value),
    };
  }

  return {
    primary: value.primary && /^#[0-9A-Fa-f]{6}$/.test(value.primary)
      ? value.primary.toUpperCase()
      : defaultThemeColours.primary,
    secondary: value.secondary && /^#[0-9A-Fa-f]{6}$/.test(value.secondary)
      ? value.secondary.toUpperCase()
      : defaultThemeColours.secondary,
    tertiary: value.tertiary && /^#[0-9A-Fa-f]{6}$/.test(value.tertiary)
      ? value.tertiary.toUpperCase()
      : defaultThemeColours.tertiary,
    quaternary: value.quaternary && /^#[0-9A-Fa-f]{6}$/.test(value.quaternary)
      ? value.quaternary.toUpperCase()
      : defaultThemeColours.quaternary,
  };
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
  // Kept for compatibility with legacy callers that pass the presentation mode.
  void mode;
  return resolveThemeBaseColour(value);
}

export function getThemeAccentColoursForMode(
  value: Partial<ThemeAccentColours> | string | null | undefined,
  mode: ThemeColourMode,
): ThemeAccentColours {
  // The selected palette is mode-independent; only neutral UI surfaces adapt.
  void mode;
  return resolveThemeAccentColours(value);
}

export function getThemeColourForeground(value: string | null | undefined, mode: ThemeColourMode): '#000000' | '#FFFFFF' {
  return getContrastForeground(getThemeColourForMode(value, mode));
}

export function resolveThemeColour(value: string | null | undefined, mode: ThemeColourMode): string {
  return getThemeColourForMode(value, mode);
}

export function applyThemeColours(
  preset: ThemePreset,
  themeColours: Partial<ThemeAccentColours> | string | null | undefined,
): ThemePreset {
  const mode = getThemeMode(preset);
  const accentColours = getThemeAccentColoursForMode(themeColours, mode);
  const colours = preset.name === 'adaptive'
    ? getThemePresetColours(mode)
    : preset.tokens.colors;
  const accent = mixHex(accentColours.secondary, colours.background, mode === 'light' ? 0.1 : 0.28);

  return {
    ...preset,
    tokens: {
      ...preset.tokens,
      colors: {
        ...colours,
        primary: accentColours.primary,
        primaryForeground: getContrastForeground(accentColours.primary),
        accent,
        accentForeground: getContrastForeground(accent),
        tertiary: accentColours.tertiary,
        tertiaryForeground: getContrastForeground(accentColours.tertiary),
        ring: accentColours.primary,
      },
      chartPaletteHooks: [
        accentColours.primary,
        accentColours.secondary,
        accentColours.tertiary,
        accentColours.quaternary,
        colours.mutedForeground,
      ],
    },
  };
}

function getThemePresetColours(mode: ThemeColourMode) {
  return mode === 'light'
    ? {
      background: '#f8fafc', foreground: '#0f172a', card: '#ffffff', cardForeground: '#0f172a',
      surface: '#ffffff', surfaceForeground: '#0f172a', popover: '#ffffff', popoverForeground: '#0f172a',
      primary: '#0f766e', primaryForeground: '#f0fdfa', secondary: '#f1f5f9', secondaryForeground: '#1e293b',
      tertiary: '#0d9488', tertiaryForeground: '#f0fdfa',
      muted: '#f1f5f9', mutedForeground: '#64748b', accent: '#f1f5f9', accentForeground: '#0f766e',
      border: '#dbe4e2', input: '#dbe4e2', ring: '#14b8a6', destructive: '#b91c1c', destructiveForeground: '#fff1f2',
    }
    : {
      background: '#0b1111', foreground: '#e6fffb', card: '#111c1b', cardForeground: '#e6fffb',
      surface: '#111c1b', surfaceForeground: '#e6fffb', popover: '#111c1b', popoverForeground: '#e6fffb',
      primary: '#2dd4bf', primaryForeground: '#042f2e', secondary: '#192523', secondaryForeground: '#d1fae5',
      tertiary: '#99f6e4', tertiaryForeground: '#042f2e',
      muted: '#182321', mutedForeground: '#9db2ae', accent: '#1c2e2b', accentForeground: '#5eead4',
      border: '#2a3b38', input: '#2a3b38', ring: '#2dd4bf', destructive: '#f87171', destructiveForeground: '#2b0b0b',
    };
}
