import { type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  BarChart3,
  BookOpen,
  Bookmark,
  ChevronDown,
  ClipboardList,
  Gauge,
  LogOut,
  ArrowRightLeft,
  Search,
  ShieldCheck,
  Users,
  UserRound,
} from 'lucide-react';

import { Button } from './components/ui/button';
import { Card } from './components/ui/card';
import type { SessionState } from './contracts';
import {
  getActiveContextItem,
  getContextNavigation,
  getNavigationItemByPath,
  isPrimaryNavigationItemActive,
  isRouteActive,
  primaryNavigationItems,
  type NavigationItem,
  type NavigationSection,
  utilityNavigationItems,
} from './navigation';
import { useThemePreset } from './theme-preset-provider';

interface AppShellProps {
  children: ReactNode;
  currentPath: string;
  onNavigate: (href: string) => void;
  onSignOut: () => void;
  session: SessionState;
}

const navigationIcons: Record<string, LucideIcon> = {
  dashboard: Gauge,
  'squad-management': Users,
  scouting: Search,
  fdr: BarChart3,
  interests: Bookmark,
  trades: ArrowRightLeft,
  'team-selection': ClipboardList,
  league: ShieldCheck,
  'league-fixtures': ClipboardList,
  'league-table': BarChart3,
  'league-knockout': ShieldCheck,
  'league-head-to-head': Users,
  rules: BookOpen,
  account: UserRound,
};

export function AppShell({
  children,
  currentPath,
  onNavigate,
  onSignOut,
  session,
}: AppShellProps) {
  const { preset } = useThemePreset();
  const contextNavigation = getContextNavigation(currentPath);
  const activePage = getNavigationItemByPath(currentPath) ?? primaryNavigationItems[0];
  const displayName = session.user?.displayName ?? 'Authenticated user';
  const isManagersDesk = currentPath === '/' || currentPath === '/dashboard';
  const initials = displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'CD';

  const navigate = (item: NavigationItem) => {
    onNavigate(item.href);
  };

  const signOut = () => {
    onSignOut();
  };

  return (
    <div className="app-shell" data-theme-preset={preset.name}>
      <aside className="app-sidebar" aria-label="Application sidebar">
        <ShellBrand compact={false} />
        <PrimaryNavigation currentPath={currentPath} onNavigate={navigate} />
        <div className="sidebar-footer">
          <UtilityNavigation currentPath={currentPath} onNavigate={navigate} />
          <div className="sidebar-session">
            <span className="account-avatar" aria-hidden="true">{initials}</span>
            <div>
              <strong>{displayName}</strong>
              <span>Manager account</span>
            </div>
          </div>
        </div>
      </aside>

      <main className="shell-main">
        <header className="shell-header">
          <div className="shell-title-group">
            <div className="shell-heading">
              <span className="eyebrow">{contextNavigation?.label ?? 'Castle Draft League'}</span>
              <h1>{activePage.label}</h1>
            </div>
          </div>

          <div
            aria-label="Shell actions"
            className="shell-actions"
            role="group"
          >
            <a
              aria-label="Open rules"
              className="shell-icon-link desktop-shell-action"
              href="/rules"
              onClick={(event) => {
                event.preventDefault();
                onNavigate('/rules');
              }}
              title="Rules"
            >
              <BookOpen aria-hidden="true" size={18} />
            </a>

            {!isManagersDesk ? (
              <details className="account-menu">
                <summary aria-label={`Account menu for ${displayName}`}>
                  <span className="account-avatar" aria-hidden="true">{initials}</span>
                  <span className="account-name">{displayName}</span>
                  <ChevronDown aria-hidden="true" size={16} />
                </summary>
                <Card className="account-popover" aria-label="Account menu">
                  <div className="account-popover-header">
                    <strong>{displayName}</strong>
                    <span>{session.user?.email ?? 'Authenticated session'}</span>
                  </div>
                  <Button
                    onClick={() => {
                      onNavigate('/account');
                    }}
                    type="button"
                    variant="secondary"
                  >
                    <UserRound aria-hidden="true" size={16} />
                    Account
                  </Button>
                  <Button onClick={signOut} type="button" variant="ghost">
                    <LogOut aria-hidden="true" size={16} />
                    Sign out
                  </Button>
                </Card>
              </details>
            ) : null}
          </div>
        </header>

        {contextNavigation ? (
          <ContextNavigation
            currentPath={currentPath}
            onNavigate={navigate}
            section={contextNavigation}
            variant="horizontal"
          />
        ) : null}

        <div className="shell-content">{children}</div>
      </main>
    </div>
  );
}

function ShellBrand({ compact }: { compact: boolean }) {
  return (
    <div className={`shell-brand${compact ? ' compact' : ''}`}>
      <span className="brand-mark">CDL</span>
      <div>
        <strong>Castle Draft League</strong>
        <span>Manager workspace</span>
      </div>
    </div>
  );
}

function PrimaryNavigation({
  currentPath,
  onNavigate,
}: {
  currentPath: string;
  onNavigate: (item: NavigationItem) => void;
}) {
  return (
    <nav aria-label="Primary navigation" className="navigation-list primary-navigation">
      {primaryNavigationItems.map((item) => (
        <NavigationLink
          isActive={isPrimaryNavigationItemActive(currentPath, item)}
          item={item}
          key={item.href}
          onNavigate={onNavigate}
        />
      ))}
    </nav>
  );
}

function UtilityNavigation({
  currentPath,
  onNavigate,
}: {
  currentPath: string;
  onNavigate: (item: NavigationItem) => void;
}) {
  return (
    <nav aria-label="Support navigation" className="navigation-list utility-navigation">
      {utilityNavigationItems.map((item) => (
        <NavigationLink
          isActive={isRouteActive(currentPath, item.href)}
          item={item}
          key={item.href}
          onNavigate={onNavigate}
        />
      ))}
    </nav>
  );
}

function ContextNavigation({
  currentPath,
  onNavigate,
  section,
  variant,
}: {
  currentPath: string;
  onNavigate: (item: NavigationItem) => void;
  section: NavigationSection;
  variant: 'horizontal' | 'stacked';
}) {
  const activeItem = getActiveContextItem(currentPath, section);

  return (
    <nav
      aria-label={section.label}
      className={`context-navigation context-navigation-${variant}`}
    >
      {section.items.map((item) => (
        <NavigationLink
          compact={variant === 'horizontal'}
          isActive={activeItem?.href === item.href}
          item={item}
          key={item.href}
          onNavigate={onNavigate}
        />
      ))}
    </nav>
  );
}

function NavigationLink({
  compact = false,
  isActive,
  item,
  onNavigate,
}: {
  compact?: boolean;
  isActive: boolean;
  item: NavigationItem;
  onNavigate: (item: NavigationItem) => void;
}) {
  const Icon = navigationIcons[item.featureKey] ?? Gauge;
  return (
    <a
      aria-current={isActive ? 'page' : undefined}
      className={`nav-item${isActive ? ' active' : ''}${compact ? ' compact' : ''}`}
      href={item.href}
      onClick={(event) => {
        event.preventDefault();
        onNavigate(item);
      }}
    >
      <Icon aria-hidden="true" className="nav-item-icon" size={18} />
      <span>{item.label}</span>
    </a>
  );
}
