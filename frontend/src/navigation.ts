export interface NavigationItem {
  label: string;
  href: string;
  featureKey: string;
  description?: string;
  supportsScouting?: boolean;
}

export interface NavigationSection {
  key: string;
  label: string;
  primaryHref: string;
  matchPrefixes: string[];
  items: NavigationItem[];
}

export const primaryNavigationItems: NavigationItem[] = [
  {
    label: 'Home',
    href: '/dashboard',
    featureKey: 'dashboard',
    description: 'Priorities, deadlines and actions that need attention',
  },
  {
    label: 'Squad',
    href: '/squad-management',
    featureKey: 'squad-management',
    description: 'Season-long squad health and roster actions',
  },
  {
    label: 'Market',
    href: '/scouting',
    featureKey: 'scouting',
    description: 'Player discovery, draws, interests and trades',
    supportsScouting: true,
  },
  {
    label: 'Matchweek',
    href: '/team-selection',
    featureKey: 'team-selection',
    description: 'Lineup, captaincy, bench and chips',
  },
  {
    label: 'League',
    href: '/league',
    featureKey: 'league',
    description: 'Fixtures, standings and competitions',
  },
];

export const contextualNavigationSections: NavigationSection[] = [
  {
    key: 'market',
    label: 'Market navigation',
    primaryHref: '/scouting',
    matchPrefixes: ['/scouting', '/fdr'],
    items: [
      {
        label: 'Discovery',
        href: '/scouting',
        featureKey: 'scouting',
        supportsScouting: true,
      },
      {
        label: 'Fixture difficulty',
        href: '/fdr',
        featureKey: 'fdr',
      },
    ],
  },
  {
    key: 'league',
    label: 'League navigation',
    primaryHref: '/league',
    matchPrefixes: ['/league'],
    items: [
      {
        label: 'Overview',
        href: '/league',
        featureKey: 'league',
      },
      {
        label: 'Fixtures',
        href: '/league/fixtures',
        featureKey: 'league-fixtures',
      },
      {
        label: 'Table',
        href: '/league/table',
        featureKey: 'league-table',
      },
      {
        label: 'Knockout',
        href: '/league/knockout',
        featureKey: 'league-knockout',
      },
      {
        label: 'Head-to-head',
        href: '/league/head-to-head',
        featureKey: 'league-head-to-head',
      },
    ],
  },
];

export const utilityNavigationItems: NavigationItem[] = [
  {
    label: 'Rules',
    href: '/rules',
    featureKey: 'rules',
    description: 'League rules and validation references',
  },
];

export function isRouteActive(currentPath: string, itemHref: string): boolean {
  if (currentPath === '/' && itemHref === '/dashboard') {
    return true;
  }

  if (itemHref === '/') {
    return currentPath === itemHref;
  }

  return currentPath === itemHref || currentPath.startsWith(`${itemHref}/`);
}

export function getContextNavigation(path: string): NavigationSection | undefined {
  return contextualNavigationSections.find((section) => (
    section.matchPrefixes.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))
  ));
}

export function getActiveContextItem(
  currentPath: string,
  section: NavigationSection,
): NavigationItem | undefined {
  return [...section.items]
    .sort((left, right) => right.href.length - left.href.length)
    .find((item) => isRouteActive(currentPath, item.href));
}

export function isPrimaryNavigationItemActive(
  currentPath: string,
  item: NavigationItem,
): boolean {
  const context = getContextNavigation(currentPath);
  if (context) {
    return context.primaryHref === item.href;
  }
  return isRouteActive(currentPath, item.href);
}

export function getNavigationItemByPath(path: string): NavigationItem | undefined {
  if (path === '/') {
    return primaryNavigationItems[0];
  }

  const contextualItems = contextualNavigationSections.flatMap((section) => section.items);
  return [...contextualItems, ...primaryNavigationItems, ...utilityNavigationItems]
    .sort((left, right) => right.href.length - left.href.length)
    .find((item) => isRouteActive(path, item.href));
}
