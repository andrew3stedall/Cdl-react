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

const accountNavigationItem: NavigationItem = {
  label: 'Account',
  href: '/account',
  featureKey: 'account',
  description: 'Account details, appearance, pitch orientation and session controls',
};

const squadRouteAliases = ['/squad', '/squad-management', '/team-selection'];

export const primaryNavigationItems: NavigationItem[] = [
  {
    label: 'Home',
    href: '/dashboard',
    featureKey: 'dashboard',
    description: 'Priorities, deadlines and actions that need attention',
  },
  {
    label: 'Squad',
    href: '/squad',
    featureKey: 'squad-management',
    description: 'Squad management, lineup, captaincy, bench, reserves and chips',
  },
  {
    label: 'Market',
    href: '/scouting',
    featureKey: 'scouting',
    description: 'Player discovery, draws, interests and trades',
    supportsScouting: true,
  },
  {
    label: 'League',
    href: '/league',
    featureKey: 'league',
    description: 'Fixtures, standings and competitions',
  },
];

export const contextualNavigationSections: NavigationSection[] = [];

export const utilityNavigationItems: NavigationItem[] = [
  {
    label: 'Rules',
    href: '/rules',
    featureKey: 'rules',
    description: 'League rules and validation references',
  },
];

export function isSquadRoute(path: string): boolean {
  return squadRouteAliases.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

export function isRouteActive(currentPath: string, itemHref: string): boolean {
  if (currentPath === '/' && itemHref === '/dashboard') {
    return true;
  }

  if (itemHref === '/squad') {
    return isSquadRoute(currentPath);
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
  if (item.href === '/scouting' && (currentPath === '/fdr' || currentPath.startsWith('/fdr/'))) {
    return true;
  }
  return isRouteActive(currentPath, item.href);
}

export function getNavigationItemByPath(path: string): NavigationItem | undefined {
  if (path === '/') {
    return primaryNavigationItems[0];
  }

  if (path === '/account' || path.startsWith('/account/') || path === '/profile' || path.startsWith('/profile/')) {
    return accountNavigationItem;
  }

  if (path === '/fdr' || path.startsWith('/fdr/')) {
    return primaryNavigationItems.find((item) => item.href === '/scouting');
  }

  const contextualItems = contextualNavigationSections.flatMap((section) => section.items);
  return [...contextualItems, ...primaryNavigationItems, ...utilityNavigationItems]
    .sort((left, right) => right.href.length - left.href.length)
    .find((item) => isRouteActive(path, item.href));
}
