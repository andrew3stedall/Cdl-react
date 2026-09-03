import { describe, expect, test } from 'vitest';

import { teamCrestAsset } from './TeamCrest';

describe('teamCrestAsset', () => {
  test('maps supplied crest ids to their matching artwork', () => {
    expect(teamCrestAsset({ id: 'team-bayer-neverlusen', name: 'Bayer Neverlusen' })).toBe('bayer-neverlusen');
    expect(teamCrestAsset({ id: 'team-stan-still-sells-tik', name: 'Stan Still Sells Tik' })).toBe('stan-still-sells-tik');
    expect(teamCrestAsset({ id: 'team-koden-all-stars', name: 'Koden All Stars' })).toBe('koden-all-stars');
    expect(teamCrestAsset({ id: 'team-class-of-84', name: 'Class of 84' })).toBe('class-of-84');
    expect(teamCrestAsset({ id: 'team-wilde-boars', name: 'Wilde Boars' })).toBe('wilde-boars');
    expect(teamCrestAsset({ id: 'team-exeter-gently', name: 'Exeter Gently' })).toBe('exeter-gently');
    expect(teamCrestAsset({ id: 'team-dicks-dribbling-xi', name: 'Dicks Dribbling XI' })).toBe('dicks-dribbling-xi');
    expect(teamCrestAsset({ id: 'team-sporting-lesbians', name: 'Sporting Lesbians' })).toBe('sporting-lesbians');
  });

  test('also resolves preview team ids by their stable team name', () => {
    expect(teamCrestAsset({ id: 'team-1', name: 'Exeter Gently' })).toBe('exeter-gently');
  });

  test('resolves a crest by name when a stable id is unavailable', () => {
    expect(teamCrestAsset({ name: 'Sporting Lesbians' })).toBe('sporting-lesbians');
  });
});
