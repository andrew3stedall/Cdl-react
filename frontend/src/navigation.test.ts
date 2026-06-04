import { describe, expect, test } from 'vitest';

import { getNavigationItemByPath, isRouteActive, primaryNavigationItems } from './navigation';

describe('navigation configuration', () => {
  test('contains all legacy core modules plus modernisation checkpoints and scouting', () => {
    expect(primaryNavigationItems.map((item) => item.label)).toEqual([
      'Squad Management',
      'Team Selection',
      'League',
      'Checkpoint 1',
      'Checkpoint 2',
      'Checkpoint 3',
      'Checkpoint 4',
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
    expect(getNavigationItemByPath('/modernisation/checkpoint-2')?.label).toBe('Checkpoint 2');
    expect(getNavigationItemByPath('/modernisation/checkpoint-3')?.label).toBe('Checkpoint 3');
    expect(getNavigationItemByPath('/modernisation/checkpoint-4')?.label).toBe('Checkpoint 4');
  });
});
