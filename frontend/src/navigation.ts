export interface NavigationItem {
  label: string;
  href: string;
  featureKey: string;
  supportsScouting?: boolean;
}

export const primaryNavigationItems: NavigationItem[] = [
  {
    label: 'Squad Management',
    href: '/squad-management',
    featureKey: 'squad-management',
    supportsScouting: true,
  },
  {
    label: 'Team Selection',
    href: '/team-selection',
    featureKey: 'team-selection',
  },
  {
    label: 'League',
    href: '/league',
    featureKey: 'league',
  },
  {
    label: 'Checkpoint 1',
    href: '/modernisation/checkpoint-1',
    featureKey: 'modernisation-checkpoint-1',
  },
  {
    label: 'Checkpoint 2',
    href: '/modernisation/checkpoint-2',
    featureKey: 'modernisation-checkpoint-2',
  },
  {
    label: 'Checkpoint 3',
    href: '/modernisation/checkpoint-3',
    featureKey: 'modernisation-checkpoint-3',
  },
  {
    label: 'Rules',
    href: '/rules',
    featureKey: 'rules',
  },
  {
    label: 'Dashboard',
    href: '/dashboard',
    featureKey: 'dashboard',
  },
  {
    label: 'FDR',
    href: '/fdr',
    featureKey: 'fdr',
  },
  {
    label: 'Scouting',
    href: '/scouting',
    featureKey: 'scouting',
    supportsScouting: true,
  },
];

export function isRouteActive(currentPath: string, itemHref: string): boolean {
  if (itemHref === '/') {
    return currentPath === itemHref;
  }

  return currentPath === itemHref || currentPath.startsWith(`${itemHref}/`);
}

export function getNavigationItemByPath(path: string): NavigationItem | undefined {
  return primaryNavigationItems.find((item) => isRouteActive(path, item.href));
}
