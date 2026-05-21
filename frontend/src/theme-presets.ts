import type { ThemePreset } from './contracts';

export const themePresets: ThemePreset[] = [
  {
    name: 'classic',
    label: 'Classic',
    isDefault: true,
    tokens: {},
  },
  {
    name: 'dark',
    label: 'Dark',
    isDefault: false,
    tokens: {},
  },
  {
    name: 'compact',
    label: 'Compact',
    isDefault: false,
    tokens: {},
  },
];

export function getDefaultThemePreset(): ThemePreset {
  return themePresets.find((preset) => preset.isDefault) ?? themePresets[0];
}
