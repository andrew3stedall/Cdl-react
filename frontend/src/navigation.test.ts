import { describe, expect, test } from 'vitest';

import { getNavigationItemByPath, isRouteActive, primaryNavigationItems } from './navigation';

describe('navigation configuration', () => {
  test('contains only product-facing release navigation', () => {
    expect(primaryNavigationItems.map((item) => item.label)).toEqual([
      'Squad Management',
      'Team Selection',
      'League',
      'Rules',
      'Dashboard',
      'FDR',
      'Scouting',
    ]);
  });

  test('does not promote checkpoint scaffolding into product navigation', () => {
    expect(primaryNavigationItems.some((item) => item.href.startsWith('/modernisation/checkpoint-'))).toBe(false);
  });

  test('detects active nested routes', () => {
    expect(isRouteActive('/squad-management/transfers', '/squad-management')).toBe(true);
    expect(isRouteActive('/league', '/league')).toBe(true);
    expect(isRouteActive('/rules', '/league')).toBe(false);
  });

  test('resolves product navigation items by path', () => {
    expect(getNavigationItemByPath('/fdr/team-1')?.label).toBe('FDR');
    expect(getNavigationItemByPath('/modernisation/checkpoint-1')).toBeUndefined();
    expect(getNavigationItemByPath('/modernisation/checkpoint-5')).toBeUndefined();
  });
});
