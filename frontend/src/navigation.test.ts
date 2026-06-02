import { describe, expect, test } from 'vitest';

import { getNavigationItemByPath, isRouteActive, primaryNavigationItems } from './navigation';

describe('navigation configuration', () => {
  test('contains all legacy core modules plus modernisation checkpoint and scouting', () => {
    expect(primaryNavigationItems.map((item) => item.label)).toEqual([
      'Squad Management',
      'Team Selection',
      'League',
      'Checkpoint 1',
      'Rules',
      'Dashboard',
      'FDR',
      'Scouting',
    ]);
  });

  test('detects active nested routes', () => {
    expect(isRouteActive('/squad-management/transfers', '/squad-management')).toBe(true);
    expect(isRouteActive('/league', '/league')).toBe(true);
    expect(isRouteActive('/rules', '/league')).toBe(false);
  });

  test('resolves navigation item by path', () => {
    expect(getNavigationItemByPath('/fdr/team-1')?.label).toBe('FDR');
    expect(getNavigationItemByPath('/modernisation/checkpoint-1')?.label).toBe('Checkpoint 1');
  });
});
