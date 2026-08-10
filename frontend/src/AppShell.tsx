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
  Menu,
  ArrowRightLeft,
  RefreshCw,
  Search,
  ShieldCheck,
  Users,
  UserRound,
  X,
} from 'lucide-react';

import { Button } from './components/ui/button';
import { Card } from './components/ui/card';
import { Select } from './components/ui/select';
import { Sheet } from './components/ui/sheet';
import type { SessionState, ThemePreset } from './contracts';
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
import { themePresets } from './theme-presets';
import { useThemePreset } from './theme-preset-provider';

interface AppShellProps {
  children: ReactNode;
  currentPath: string;
  isMobileNavigationOpen: boolean;
  onCloseMobileNavigation: () => void;
  onNavigate: (href: string) => void;
  onOpenMobileNavigation: () => void;
  onRefresh: () => void;
  onSignOut: () => void;
  refreshCount: number;
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
  profile: UserRound,
};

export function AppShell({
  children,
  currentPath,
  isMobileNavigationOpen,
  onCloseMobileNavigation,
  onNavigate,
  onOpenMobileNavigation,
  onRefresh,
  onSignOut,
  refreshCount,
  session,
}: AppShellProps) {
  const { preset, saveStatus, setPresetName } = useThemePreset();
  const contextNavigation = getContextNavigation(currentPath);
  const activePage = getNavigationItemByPath(currentPath) ?? primaryNavigationItems[0];
  const displayName = session.user?.displayName ?? 'Authenticated user';
  const initials = displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'CD';

  const navigate = (item: NavigationItem) => {
    onNavigate(item.href);
    onCloseMobileNavigation();
  };

  const signOut = () => {
    onCloseMobileNavigation();
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

      {isMobileNavigationOpen ? (
        <button
          aria-label="Close navigation"
          className="sheet-backdrop"
          onClick={onCloseMobileNavigation}
          type="button"
        />
      ) : null}

      <Sheet id="mobile-navigation" isOpen={isMobileNavigationOpen} labelledBy="mobile-navigation-title">
        <div className="mobile-sheet-header">
          <ShellBrand compact />
          <Button
            aria-label="Close navigation"
            className="shell-icon-button"
            onClick={onCloseMobileNavigation}
            type="button"
            variant="ghost"
          >
            <X aria-hidden="true" size={20} />
          </Button>
        </div>

        <div className="mobile-navigation-content">
          <section aria-labelledby="mobile-navigation-title">
            <p className="navigation-label" id="mobile-navigation-title">Workspace</p>
            <PrimaryNavigation currentPath={currentPath} onNavigate={navigate} />
          </section>

          {contextNavigation ? (
            <section aria-labelledby="mobile-context-navigation-title">
              <p className="navigation-label" id="mobile-context-navigation-title">
                {contextNavigation.label}
              </p>
              <ContextNavigation
                currentPath={currentPath}
                onNavigate={navigate}
                section={contextNavigation}
                variant="stacked"
              />
            </section>
          ) : null}

          <section aria-labelledby="mobile-support-navigation-title">
            <p className="navigation-label" id="mobile-support-navigation-title">Support</p>
            <UtilityNavigation currentPath={currentPath} onNavigate={navigate} />
          </section>
        </div>

        <Card className="mobile-account-card" aria-label="Account settings">
          <div className="account-summary">
            <span className="account-avatar" aria-hidden="true">{initials}</span>
            <div>
              <strong>{displayName}</strong>
              <span>Signed in</span>
            </div>
          </div>
          <PresetSelector
            controlId="mobile-visual-preset"
            preset={preset}
            saveStatus={saveStatus}
            setPresetName={setPresetName}
          />
          <div className="mobile-account-actions">
            <Button
              onClick={() => {
                onNavigate('/profile');
                onCloseMobileNavigation();
              }}
              type="button"
              variant="secondary"
            >
              <UserRound aria-hidden="true" size={16} />
              Profile & preferences
            </Button>
            <Button onClick={onRefresh} type="button" variant="secondary">
              <RefreshCw aria-hidden="true" size={16} />
              Refresh data
            </Button>
            <Button onClick={signOut} type="button" variant="ghost">
              <LogOut aria-hidden="true" size={16} />
              Sign out
            </Button>
          </div>
        </Card>
      </Sheet>

      <main className="shell-main">
        <header className="shell-header">
          <div className="shell-title-group">
            <Button
              aria-controls="mobile-navigation"
              aria-expanded={isMobileNavigationOpen}
              aria-label="Menu"
              className="mobile-menu-button shell-icon-button"
              onClick={onOpenMobileNavigation}
              type="button"
              variant="ghost"
            >
              <Menu aria-hidden="true" size={20} />
            </Button>

            <div className="shell-heading">
              <span className="eyebrow">{contextNavigation?.label ?? 'Castle Draft League'}</span>
              <h1>{activePage.label}</h1>
            </div>
          </div>

          <div
            aria-hidden={isMobileNavigationOpen || undefined}
            aria-label="Shell actions"
            className="shell-actions"
            role="group"
          >
            <Button
              aria-label="Reload data"
              className="shell-icon-button desktop-shell-action"
              onClick={onRefresh}
              title="Reload data"
              type="button"
              variant="ghost"
            >
              <RefreshCw aria-hidden="true" size={18} />
            </Button>
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
                <PresetSelector
                  controlId="desktop-visual-preset"
                  preset={preset}
                  saveStatus={saveStatus}
                  setPresetName={setPresetName}
                />
                <p className="refresh-count">Manual data refreshes: {refreshCount}</p>
                <Button
                  onClick={() => {
                    onNavigate('/profile');
                  }}
                  type="button"
                  variant="secondary"
                >
                  <UserRound aria-hidden="true" size={16} />
                  Profile & preferences
                </Button>
                <Button onClick={signOut} type="button" variant="ghost">
                  <LogOut aria-hidden="true" size={16} />
                  Sign out
                </Button>
              </Card>
            </details>
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

function PresetSelector({
  controlId,
  preset,
  saveStatus,
  setPresetName,
}: {
  controlId: string;
  preset: ThemePreset;
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';
  setPresetName: (presetName: ThemePreset['name']) => void;
}) {
  return (
    <div className="preset-control">
      <Select
        aria-label="Visual preset"
        id={controlId}
        label="Appearance"
        onChange={(event) => {
          setPresetName(event.target.value as ThemePreset['name']);
        }}
        options={themePresets.map((themePreset) => ({
          label: themePreset.label,
          value: themePreset.name,
        }))}
        value={preset.name}
      />
      <span aria-live="polite" className="preset-save-status">
        {saveStatus === 'saving' ? 'Saving appearance' : null}
        {saveStatus === 'saved' ? 'Appearance saved' : null}
        {saveStatus === 'error' ? 'Using local appearance fallback' : null}
      </span>
    </div>
  );
}
