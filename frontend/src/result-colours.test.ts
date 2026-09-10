import { describe, expect, it } from 'vitest';

import {
  defaultResultColours,
  getResultColourPaletteLabel,
  resolveResultColours,
  resultColourPresets,
} from './result-colours';

describe('result colour palettes', () => {
  it('uses independent semantic defaults', () => {
    expect(defaultResultColours).toEqual({
      win: '#22C55E',
      draw: '#F59E0B',
      loss: '#F43F5E',
    });
  });

  it('normalises valid custom colours and falls back for invalid values', () => {
    expect(resolveResultColours({
      win: '#123abc',
      draw: 'red',
      loss: '#abcdef',
    })).toEqual({
      win: '#123ABC',
      draw: '#F59E0B',
      loss: '#ABCDEF',
    });
  });

  it('labels presets and custom palettes correctly', () => {
    expect(getResultColourPaletteLabel(resultColourPresets[1].colours)).toBe('Colour-safe');
    expect(getResultColourPaletteLabel({ win: '#123456', draw: '#654321', loss: '#ABCDEF' })).toBe('Custom');
  });
});
