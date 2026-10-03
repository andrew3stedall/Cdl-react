import { describe, expect, test } from 'vitest';

import {
  applyThemeColours,
  contrastRatio,
  deriveThemeColourVariants,
  getAccessibleAccentText,
  getThemeAccentColoursForMode,
  getThemeColourPalette,
  resolveThemeAccentColours,
  resolveThemeColourVariants,
  themeColourPalettes,
} from './theme-colours';
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

  test('keeps a mode-specific companion palette for every template', () => {
    const ocean = themeColourPalettes.find((palette) => palette.name === 'ocean');

    expect(ocean?.lightColours.primary).toBe('#1D4ED8');
    expect(ocean?.darkColours.primary).toBe('#2563EB');
    expect(resolveThemeColourVariants({ light: ocean?.lightColours, dark: ocean?.darkColours })).toEqual({
      light: ocean?.lightColours,
      dark: ocean?.darkColours,
    });
  });

  test('derives a nearby companion while retaining the selected colour weight', () => {
    const variants = deriveThemeColourVariants('#0F766E', 'dark');
    expect(variants.light.primary).toBe('#0C615A');
    expect(variants.dark.primary).toBe('#0F766E');
  });

  test('provides readable text tokens without changing exact custom fills', () => {
    const custom = '#000000';
    const darkSurfaces = ['#0B1111', '#111C1B', '#192523', '#182321', '#1C2E2B'];
    const text = getAccessibleAccentText(custom, darkSurfaces);
    expect(custom).toBe('#000000');
    expect(text).not.toBe(custom);
    darkSurfaces.forEach((surface) => expect(contrastRatio(text, surface)).toBeGreaterThanOrEqual(4.5));
  });

  test('text tokens retain original preset accents only where they meet normal text contrast', () => {
    const surfacePairs = [
      ['#F8FAFC', '#FFFFFF', '#F1F5F9'],
      ['#0B1111', '#111C1B', '#192523', '#182321', '#1C2E2B'],
    ];
    themeColourPalettes.forEach(({ lightColours, darkColours }) => {
      [lightColours, darkColours].forEach((palette, modeIndex) => {
        Object.values(palette).forEach((colour) => {
          const surfaces = surfacePairs[modeIndex];
          const text = getAccessibleAccentText(colour, surfaces);
          surfaces.forEach((surface) => expect(contrastRatio(text, surface)).toBeGreaterThanOrEqual(4.5));
        });
      });
    });
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
