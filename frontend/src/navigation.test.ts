import { describe, expect, test } from 'vitest';

import {
  contextualNavigationSections,
  getActiveContextItem,
  getContextNavigation,
  getNavigationItemByPath,
  isPrimaryNavigationItemActive,
  isRouteActive,
  primaryNavigationItems,
  utilityNavigationItems,
} from './navigation';

describe('navigation configuration', () => {
  test('keeps the global navigation focused on four manager destinations', () => {
    expect(primaryNavigationItems.map((item) => item.label)).toEqual([
      'Overview',
      'Squad',
      'Team',
      'League',
    ]);
  });

  test('moves specialist routes into contextual navigation', () => {
    const squad = contextualNavigationSections.find((section) => section.key === 'squad');
    const league = contextualNavigationSections.find((section) => section.key === 'league');

    expect(squad?.items.map((item) => item.label)).toEqual([
      'My squad',
      'Scouting',
      'Fixture difficulty',
    ]);
    expect(league?.items.map((item) => item.label)).toEqual([
      'Overview',
      'Fixtures',
      'Table',
      'Knockout',
      'Head-to-head',
    ]);
    expect(utilityNavigationItems.map((item) => item.label)).toEqual(['Rules']);
  });

  test('does not promote checkpoint scaffolding into product navigation', () => {
    expect(primaryNavigationItems.some((item) => item.href.startsWith('/modernisation/checkpoint-'))).toBe(false);
  });

  test('detects active nested routes and the root overview alias', () => {
    expect(isRouteActive('/squad-management/transfers', '/squad-management')).toBe(true);
    expect(isRouteActive('/league', '/league')).toBe(true);
    expect(isRouteActive('/rules', '/league')).toBe(false);
    expect(isRouteActive('/', '/dashboard')).toBe(true);
  });

  test('keeps contextual routes attached to their primary destination', () => {
    const scoutingItem = primaryNavigationItems.find((item) => item.href === '/squad-management');
    const leagueItem = primaryNavigationItems.find((item) => item.href === '/league');

    expect(getContextNavigation('/scouting')?.key).toBe('squad');
    expect(getContextNavigation('/league/table')?.key).toBe('league');
    expect(scoutingItem && isPrimaryNavigationItemActive('/scouting', scoutingItem)).toBe(true);
    expect(leagueItem && isPrimaryNavigationItemActive('/league/fixtures', leagueItem)).toBe(true);
  });

  test('selects the most specific contextual route', () => {
    const league = getContextNavigation('/league/head-to-head');
    expect(league && getActiveContextItem('/league/head-to-head', league)?.label).toBe('Head-to-head');
  });

  test('resolves product navigation items by path', () => {
    expect(getNavigationItemByPath('/fdr/team-1')?.label).toBe('Fixture difficulty');
    expect(getNavigationItemByPath('/league/table')?.label).toBe('Table');
    expect(getNavigationItemByPath('/')?.label).toBe('Overview');
    expect(getNavigationItemByPath('/modernisation/checkpoint-1')).toBeUndefined();
    expect(getNavigationItemByPath('/modernisation/checkpoint-5')).toBeUndefined();
  });
});
