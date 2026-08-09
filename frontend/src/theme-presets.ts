import type { ThemePreset, ThemePresetName } from './contracts';

const lightColors = {
  background: '#f8fafc',
  foreground: '#0f172a',
  card: '#ffffff',
  cardForeground: '#0f172a',
  surface: '#ffffff',
  surfaceForeground: '#0f172a',
  popover: '#ffffff',
  popoverForeground: '#0f172a',
  primary: '#0f766e',
  primaryForeground: '#f0fdfa',
  secondary: '#f1f5f9',
  secondaryForeground: '#1e293b',
  muted: '#f1f5f9',
  mutedForeground: '#64748b',
  accent: '#f1f5f9',
  accentForeground: '#0f766e',
  border: '#dbe4e2',
  input: '#dbe4e2',
  ring: '#14b8a6',
  destructive: '#b91c1c',
  destructiveForeground: '#fff1f2',
};

const darkColors = {
  background: '#0b1111',
  foreground: '#e6fffb',
  card: '#111c1b',
  cardForeground: '#e6fffb',
  surface: '#111c1b',
  surfaceForeground: '#e6fffb',
  popover: '#111c1b',
  popoverForeground: '#e6fffb',
  primary: '#2dd4bf',
  primaryForeground: '#042f2e',
  secondary: '#192523',
  secondaryForeground: '#d1fae5',
  muted: '#182321',
  mutedForeground: '#9db2ae',
  accent: '#1c2e2b',
  accentForeground: '#5eead4',
  border: '#2a3b38',
  input: '#2a3b38',
  ring: '#2dd4bf',
  destructive: '#f87171',
  destructiveForeground: '#2b0b0b',
};

const lightPalette = ['#0f766e', '#115e59', '#0d9488', '#64748b'];
const darkPalette = ['#2dd4bf', '#5eead4', '#99f6e4', '#94a3b8'];

export const themePresets: ThemePreset[] = [
  {
    name: 'teal-light',
    label: 'Teal · Light',
    description: 'A bright, restrained workspace with teal actions.',
    isDefault: true,
    tokens: {
      colors: lightColors,
      density: 'comfortable',
      radius: '0.65rem',
      typographyScale: 'standard',
      chartPaletteHooks: lightPalette,
    },
  },
  {
    name: 'teal-dark',
    label: 'Teal · Dark',
    description: 'A deep, low-contrast workspace for evening sessions.',
    isDefault: false,
    tokens: {
      colors: darkColors,
      density: 'comfortable',
      radius: '0.65rem',
      typographyScale: 'standard',
      chartPaletteHooks: darkPalette,
    },
  },
  {
    name: 'teal-light-compact',
    label: 'Teal · Light Compact',
    description: 'The light theme with tighter tables and controls.',
    isDefault: false,
    tokens: {
      colors: lightColors,
      density: 'compact',
      radius: '0.45rem',
      typographyScale: 'condensed',
      chartPaletteHooks: lightPalette,
    },
  },
  {
    name: 'teal-dark-compact',
    label: 'Teal · Dark Compact',
    description: 'The dark theme with tighter tables and controls.',
    isDefault: false,
    tokens: {
      colors: darkColors,
      density: 'compact',
      radius: '0.45rem',
      typographyScale: 'condensed',
      chartPaletteHooks: darkPalette,
    },
  },
];

const legacyPresetAliases: Record<string, ThemePresetName> = {
  classic: 'teal-light',
  dark: 'teal-dark',
  compact: 'teal-light-compact',
};

export function getDefaultThemePreset(): ThemePreset {
  return themePresets.find((preset) => preset.isDefault) ?? themePresets[0];
}

export function resolveThemePreset(name: string | null | undefined): ThemePreset {
  const resolvedName = legacyPresetAliases[name ?? ''] ?? name;
  return themePresets.find((preset) => preset.name === resolvedName) ?? getDefaultThemePreset();
}

export function getThemePresetClassName(preset: ThemePreset): string {
  return `theme-${preset.name} density-${preset.tokens.density} type-${preset.tokens.typographyScale}`;
}

export function getThemeMode(preset: ThemePreset): 'light' | 'dark' {
  return preset.name.includes('dark') ? 'dark' : 'light';
}
