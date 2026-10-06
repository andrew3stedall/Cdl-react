import type { LucideIcon } from 'lucide-react';
import { BookOpen, Gauge, LampDesk, Search, ShieldCheck, Users } from 'lucide-react';

import {
  isPrimaryNavigationItemActive,
  primaryNavigationItems,
  type NavigationItem,
} from './navigation';
import './global-navigation.css';

interface GlobalNavigationProps {
  currentPath: string;
  onNavigate: (href: string) => void;
}

const navigationIcons: Record<string, LucideIcon> = {
  dashboard: LampDesk,
  'squad-management': Users,
  scouting: Search,
  league: ShieldCheck,
};

export function GlobalNavigation({ currentPath, onNavigate }: GlobalNavigationProps) {
  const rulesActive = currentPath === '/rules' || currentPath.startsWith('/rules/');
  return (
    <>
      <nav aria-label="Global mobile navigation" className="global-mobile-navigation">
        {primaryNavigationItems.map((item) => (
          <GlobalNavigationLink
            currentPath={currentPath}
            item={item}
            key={item.href}
            onNavigate={onNavigate}
          />
        ))}
      </nav>
      <a
        aria-current={rulesActive ? 'page' : undefined}
        aria-label="Open Rules"
        className={rulesActive ? 'global-mobile-rules-link active' : 'global-mobile-rules-link'}
        href="/rules"
        onClick={(event) => {
          event.preventDefault();
          onNavigate('/rules');
        }}
      >
        <BookOpen aria-hidden="true" size={16} />
        <span>Rules</span>
      </a>
    </>
  );
}

function GlobalNavigationLink({
  currentPath,
  item,
  onNavigate,
}: {
  currentPath: string;
  item: NavigationItem;
  onNavigate: (href: string) => void;
}) {
  const Icon = navigationIcons[item.featureKey] ?? Gauge;
  const isActive = isPrimaryNavigationItemActive(currentPath, item);

  return (
    <a
      aria-current={isActive ? 'page' : undefined}
      className={isActive ? 'active' : undefined}
      href={item.href}
      onClick={(event) => {
        event.preventDefault();
        onNavigate(item.href);
      }}
    >
      <Icon aria-hidden="true" size={19} />
      <span>{item.label}</span>
    </a>
  );
}
