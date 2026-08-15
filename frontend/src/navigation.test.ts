import { describe, expect, test } from 'vitest';

import {
  contextualNavigationSections,
  getActiveContextItem,
  getContextNavigation,
  getNavigationItemByPath,
  isPrimaryNavigationItemActive,
  isRouteActive,
  isSquadRoute,
  primaryNavigationItems,
  utilityNavigationItems,
} from './navigation';

describe('navigation configuration', () => {
  test('uses the four global manager destinations', () => {
    expect(primaryNavigationItems.map((item) => item.label)).toEqual([
      'Desk',
      'Squad',
      'Market',
      'League',
    ]);
  });

  test('keeps the League page as a single contextual destination', () => {
    const market = contextualNavigationSections.find((section) => section.key === 'market');
    const league = contextualNavigationSections.find((section) => section.key === 'league');

    expect(market).toBeUndefined();
    expect(league).toBeUndefined();
    expect(utilityNavigationItems.map((item) => item.label)).toEqual(['Rules']);
  });

  test('does not promote checkpoint scaffolding into product navigation', () => {
    expect(primaryNavigationItems.some((item) => item.href.startsWith('/modernisation/checkpoint-'))).toBe(false);
  });

  test('treats legacy squad and team-selection paths as the unified Squad destination', () => {
    expect(isSquadRoute('/squad')).toBe(true);
    expect(isSquadRoute('/squad/player-1')).toBe(true);
    expect(isSquadRoute('/squad-management')).toBe(true);
    expect(isSquadRoute('/team-selection')).toBe(true);
    expect(isRouteActive('/team-selection', '/squad')).toBe(true);
    expect(isRouteActive('/squad-management/player-1', '/squad')).toBe(true);
  });

  test('detects active nested routes and the root home alias', () => {
    expect(isRouteActive('/league', '/league')).toBe(true);
    expect(isRouteActive('/rules', '/league')).toBe(false);
    expect(isRouteActive('/', '/dashboard')).toBe(true);
  });

  test('keeps contextual routes attached to their primary destination', () => {
    const marketItem = primaryNavigationItems.find((item) => item.href === '/scouting');
    const squadItem = primaryNavigationItems.find((item) => item.href === '/squad');
    const leagueItem = primaryNavigationItems.find((item) => item.href === '/league');

    expect(getContextNavigation('/scouting')).toBeUndefined();
    expect(getContextNavigation('/fdr')).toBeUndefined();
    expect(getContextNavigation('/squad')).toBeUndefined();
    expect(getContextNavigation('/league/table')).toBeUndefined();
    expect(marketItem && isPrimaryNavigationItemActive('/scouting', marketItem)).toBe(true);
    expect(marketItem && isPrimaryNavigationItemActive('/fdr', marketItem)).toBe(true);
    expect(squadItem && isPrimaryNavigationItemActive('/team-selection', squadItem)).toBe(true);
    expect(leagueItem && isPrimaryNavigationItemActive('/league/fixtures', leagueItem)).toBe(true);
  });

  test('does not expose a second League navigation surface', () => {
    expect(getActiveContextItem('/league/table', { key: 'league', label: 'League', primaryHref: '/league', matchPrefixes: ['/league'], items: [] })).toBeUndefined();
  });

  test('resolves product navigation items by path', () => {
    expect(getNavigationItemByPath('/fdr/team-1')?.label).toBe('Market');
    expect(getNavigationItemByPath('/league/table')?.label).toBe('League');
    expect(getNavigationItemByPath('/squad')?.label).toBe('Squad');
    expect(getNavigationItemByPath('/squad-management')?.label).toBe('Squad');
    expect(getNavigationItemByPath('/team-selection')?.label).toBe('Squad');
    expect(getNavigationItemByPath('/')?.label).toBe('Desk');
    expect(getNavigationItemByPath('/account')?.label).toBe('Account');
    expect(getNavigationItemByPath('/profile')?.label).toBe('Account');
    expect(getNavigationItemByPath('/modernisation/checkpoint-1')).toBeUndefined();
    expect(getNavigationItemByPath('/modernisation/checkpoint-5')).toBeUndefined();
  });
});
