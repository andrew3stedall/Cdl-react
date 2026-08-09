const FPL_SHIRT_CODES: Record<string, number> = {
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
  TOT: 6,
  SUN: 56,
};

export function officialFplShirtUrl(team: string, large = false): string | null {
  const code = FPL_SHIRT_CODES[team.trim().toUpperCase()];
  if (!code) return null;
  return `https://fantasy.premierleague.com/dist/img/shirts/standard/shirt_${code}-${large ? 110 : 66}.webp`;
}
