import { describe, expect, test } from 'vitest';

import { officialFplShirtUrl } from './fpl-shirt-assets';

describe('official FPL shirt assets', () => {
  test('maps every current club short name to the official FPL asset code', () => {
    const expectedCodes: Record<string, number> = {
      ARS: 3,
      AVL: 7,
      BOU: 91,
      BRE: 94,
      BHA: 36,
      CHE: 8,
      COV: 9,
      CRY: 31,
      EVE: 11,
      FUL: 54,
      HUL: 88,
      IPS: 40,
      LEE: 2,
      LIV: 14,
      MCI: 43,
      MUN: 1,
      NEW: 4,
      NFO: 17,
      SUN: 56,
      TOT: 6,
    };

    for (const [shortName, code] of Object.entries(expectedCodes)) {
      expect(officialFplShirtUrl(shortName)).toBe(
        `https://fantasy.premierleague.com/dist/img/shirts/standard/shirt_${code}-66.webp`,
      );
      expect(officialFplShirtUrl(shortName, true)).toContain(`shirt_${code}-110.webp`);
    }
  });

  test('returns no remote URL for unknown team codes', () => {
    expect(officialFplShirtUrl('WHU')).toBeNull();
  });
});
