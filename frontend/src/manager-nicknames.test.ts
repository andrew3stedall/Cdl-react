import { describe, expect, it } from 'vitest';

import { managerNicknameForName, managerNicknameForTeam } from './manager-nicknames';

describe('manager nicknames', () => {
  it('uses the canonical nickname for every staging team', () => {
    expect(managerNicknameForTeam({ id: 'team-dicks-dribbling-xi', name: 'Dicks Dribbling XI', managerName: 'Richard' })).toBe('Rich');
    expect(managerNicknameForTeam({ id: 'team-koden-all-stars', name: 'Koden All Stars', managerName: 'Nielsen' })).toBe('Nath');
  });

  it('normalizes legacy labels when only a manager name is available', () => {
    expect(managerNicknameForName('Richard')).toBe('Rich');
    expect(managerNicknameForName('Nielsen')).toBe('Nath');
  });
});
