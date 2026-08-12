import { describe, expect, test } from 'vitest';

import {
  fdrColourScales,
  getFdrPalette,
  getFdrColourScale,
} from './fdr-colour-scales';

describe('FDR colour scales', () => {
  test('contains every non-categorical D3 interpolator as five hex steps', () => {
    expect(fdrColourScales).toHaveLength(38);
    expect(fdrColourScales.every((scale) => scale.light.length === 5 && scale.dark.length === 5)).toBe(true);
    expect(fdrColourScales.flatMap((scale) => [...scale.light, ...scale.dark]).every((colour) => /^#[0-9A-F]{6}$/.test(colour))).toBe(true);
    expect(fdrColourScales.filter((scale) => scale.group === 'Cyclical').map((scale) => scale.name)).toEqual([
      'Rainbow',
      'Sinebow',
    ]);
  });

  test('reverses the selected FDR order without changing the scale colours', () => {
    const normal = getFdrPalette('RdYlGn', 'light', false);
    const reversed = getFdrPalette('RdYlGn', 'light', true);

    expect(reversed).toEqual([...normal].reverse());
    expect(getFdrColourScale('RdYlGn').isCyclical).toBe(false);
  });
});
