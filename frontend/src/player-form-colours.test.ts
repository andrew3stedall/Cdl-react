import { describe, expect, test } from 'vitest';

import { playerFormColour } from './player-form-colours';

describe('player form colours', () => {
  test('uses the five agreed score bands for fixtures with minutes', () => {
    expect([0, 1, 2, 3, 4, 5, 6, 7].map((points) => playerFormColour(points, 90))).toEqual([
      '1', '2', '2', '3', '3', '4', '4', '5',
    ]);
    expect(playerFormColour(-1, 90)).toBe('1');
  });

  test('keeps non-appearances grey regardless of the recorded points', () => {
    expect(playerFormColour(8, 0)).toBe('empty');
    expect(playerFormColour(8, null)).toBe('empty');
    expect(playerFormColour(null, 0)).toBe('empty');
  });
});
