import { describe, expect, test } from 'vitest';

import { applyThemeColours, getThemeAccentColoursForMode, getThemeColourPalette, resolveThemeAccentColours, themeColourPalettes } from './theme-colours';
import { resolveThemePreset } from './theme-presets';

describe('theme accent colours', () => {
  test('keeps the legacy single-colour value as the primary accent', () => {
    expect(resolveThemeAccentColours('#2563EB')).toEqual({
      primary: '#2563EB',
      secondary: '#115E59',
      tertiary: '#0D9488',
      quaternary: '#14B8A6',
    });
  });

  test('exposes complete four-accent templates and recognises exact selections', () => {
    expect(themeColourPalettes).toHaveLength(6);
    expect(themeColourPalettes.every((palette) => Object.keys(palette.colours).length === 4)).toBe(true);
    expect(getThemeColourPalette(themeColourPalettes[1].colours)?.name).toBe('ocean');
    expect(getThemeColourPalette({ ...themeColourPalettes[1].colours, primary: '#000000' })).toBeNull();
  });

  test('preserves all four selected accents in dark mode', () => {
    const selectedColours = {
      primary: '#2563EB',
      secondary: '#7C3AED',
      tertiary: '#BE123C',
      quaternary: '#C2410C',
    };
    expect(getThemeAccentColoursForMode(selectedColours, 'dark')).toEqual(selectedColours);
    expect(applyThemeColours(resolveThemePreset('teal-dark'), selectedColours).tokens.chartPaletteHooks.slice(0, 4)).toEqual(Object.values(selectedColours));
  });

  test('applies independent accent hooks without changing the neutral secondary surface', () => {
    const preset = applyThemeColours(resolveThemePreset('teal-light'), {
      primary: '#2563EB',
      secondary: '#7C3AED',
      tertiary: '#BE123C',
      quaternary: '#C2410C',
    });

    expect(preset.tokens.colors.primary).toBe('#2563EB');
    expect(preset.tokens.colors.secondary).toBe('#f1f5f9');
    expect(preset.tokens.colors.tertiary).toBe('#BE123C');
    expect(preset.tokens.chartPaletteHooks.slice(0, 4)).toEqual(['#2563EB', '#7C3AED', '#BE123C', '#C2410C']);
  });
});
