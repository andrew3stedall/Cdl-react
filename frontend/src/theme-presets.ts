import type { ThemePreset } from './contracts';

export const themePresets: ThemePreset[] = [
  {
    name: 'classic',
    label: 'Classic',
    isDefault: true,
    tokens: {
      colors: {
        background: '#f8fafc',
        foreground: '#0f172a',
        surface: '#ffffff',
        surfaceForeground: '#111827',
        primary: '#1d4ed8',
        primaryForeground: '#ffffff',
        muted: '#e2e8f0',
        mutedForeground: '#475569',
        border: '#cbd5e1',
        accent: '#dbeafe',
      },
      density: 'comfortable',
      radius: '0.875rem',
      typographyScale: 'standard',
      chartPaletteHooks: ['#1d4ed8', '#0f766e', '#b45309', '#be123c'],
    },
  },
  {
    name: 'dark',
    label: 'Dark',
    isDefault: false,
    tokens: {
      colors: {
        background: '#0f172a',
        foreground: '#f8fafc',
        surface: '#111827',
        surfaceForeground: '#f9fafb',
        primary: '#60a5fa',
        primaryForeground: '#0f172a',
        muted: '#1e293b',
        mutedForeground: '#cbd5e1',
        border: '#334155',
        accent: '#1e3a8a',
      },
      density: 'comfortable',
      radius: '0.875rem',
      typographyScale: 'standard',
      chartPaletteHooks: ['#60a5fa', '#34d399', '#fbbf24', '#fb7185'],
    },
  },
  {
    name: 'compact',
    label: 'Compact',
    isDefault: false,
    tokens: {
      colors: {
        background: '#f9fafb',
        foreground: '#111827',
        surface: '#ffffff',
        surfaceForeground: '#111827',
        primary: '#4338ca',
        primaryForeground: '#ffffff',
        muted: '#e5e7eb',
        mutedForeground: '#4b5563',
        border: '#d1d5db',
        accent: '#e0e7ff',
      },
      density: 'compact',
      radius: '0.5rem',
      typographyScale: 'condensed',
      chartPaletteHooks: ['#4338ca', '#047857', '#c2410c', '#be185d'],
    },
  },
];

export function getDefaultThemePreset(): ThemePreset {
  return themePresets.find((preset) => preset.isDefault) ?? themePresets[0];
}

export function resolveThemePreset(name: string | null | undefined): ThemePreset {
  return themePresets.find((preset) => preset.name === name) ?? getDefaultThemePreset();
}

export function getThemePresetClassName(preset: ThemePreset): string {
  return `theme-${preset.name} density-${preset.tokens.density} type-${preset.tokens.typographyScale}`;
}
