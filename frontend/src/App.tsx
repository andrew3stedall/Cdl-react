import { type FormEvent, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

import {
  canAccessProtectedRoute,
  defaultSessionClient,
  getAppleAuthConfig,
  getPasskeyAuthConfig,
  getUnauthenticatedSession,
  type SessionClient,
} from './auth';
import { AppShell } from './AppShell';
import { useAccountMotionGesture } from './account-motion-gesture';
import { AnalyticsDashboardPage } from './AnalyticsDashboardPage';
import type { RuleSection, SessionState } from './contracts';
import type { DashboardClient } from './dashboard-api';
import { FixtureDifficultyPage } from './FixtureDifficultyPage';
import type { FdrClient } from './fdr-api';
import { GlobalNavigation } from './GlobalNavigation';
import { LeaguePage } from './LeaguePage';
import type { LeagueClient } from './league-api';
import { LoginPage } from './LoginPage';
import { MarketPage } from './MarketPage';
import { ManagerDeskPage } from './ManagerDeskPage';
import type { ManagerDeskClient } from './manager-desk-api';
import { ModernisationCheckpointPage } from './ModernisationCheckpointPage';
import { getPageRouteKey, isSquadRoute } from './navigation';
import { PlayerProfilePage } from './PlayerProfilePage';
import type { PreferenceClient } from './preferences-api';
import { ProfilePage } from './ProfilePage';
import { ResultColourProfilePage } from './ResultColourProfilePage';
import { loginWithPasskey } from './passkeys';
import { RulesPage } from './RulesPage';
import { SessionSplash } from './SessionSplash';
import { SquadWorkspacePage } from './SquadWorkspacePage';
import type { SquadClient } from './squad-api';
import type { TeamSelectionClient } from './team-selection-api';
import { ThemePresetProvider, useThemePreset } from './theme-preset-provider';
import { getStoredThemePreset } from './theme-cookie';
import { LocalStoragePreferenceClient } from './preferences-api';

const loginPreferenceClient = new LocalStoragePreferenceClient();

const rulesVersion = {
  version: '2026.05',
  effectiveDate: '2026-05-22',
  status: 'active',
  source: 'docs/features/active/rules-knowledge-base.md',
};

const featuredRules: RuleSection[] = [
  {
    id: 'squad-size',
    title: 'Squad Size',
    category: 'squads',
    summary: 'Squads must remain within approved roster limits.',
    body: ['Validation errors should link to this stable rule identifier.'],
    tags: ['squad', 'validation'],
    anchors: ['squad-size'],
    relatedRuleIds: ['transfer-deadline'],
    version: rulesVersion,
  },
  {
    id: 'trade-window',
    title: 'Trade Window',
    category: 'trades',
    summary: 'Trades are only valid during configured trade windows.',
    body: ['Trade proposals can only be accepted while the trade window is open.'],
    tags: ['trades', 'commissioner'],
    anchors: ['trade-window'],
    relatedRuleIds: ['commissioner-decisions'],
    version: rulesVersion,
  },
  {
    id: 'lineup-validation',
    title: 'Lineup Validation',
    category: 'squads',
    summary: 'Lineups must satisfy starter, bench, reserve, and captaincy rules.',
    body: ['Team selection validation links to this stable rule identifier.'],
    tags: ['team-selection', 'validation'],
    anchors: ['lineup-validation'],
    relatedRuleIds: ['chip-usage', 'captaincy'],
    version: rulesVersion,
  },
  {
    id: 'chip-usage',
    title: 'Chip Usage',
    category: 'squads',
    summary: 'Only one unused chip can be active at a time.',
    body: ['Used chips cannot be reactivated.'],
    tags: ['chips', 'team-selection'],
    anchors: ['chip-usage'],
    relatedRuleIds: ['lineup-validation'],
    version: rulesVersion,
  },
];

interface AppProps {
  dashboardClient?: DashboardClient;
  fdrClient?: FdrClient;
  initialPath?: string;
  leagueClient?: LeagueClient;
  managerDeskClient?: ManagerDeskClient;
  preferenceClient?: PreferenceClient;
  session?: SessionState;
  sessionClient?: SessionClient;
  squadClient?: SquadClient;
  teamSelectionClient?: TeamSelectionClient;
}

export function App({
  dashboardClient,
  fdrClient,
  initialPath = window.location.pathname,
  leagueClient,
  managerDeskClient,
  preferenceClient,
  session,
  sessionClient = defaultSessionClient,
  squadClient,
  teamSelectionClient,
}: AppProps) {
  const [currentPath, setCurrentPath] = useState(initialPath);
  const [activeSession, setActiveSession] = useState<SessionState | null>(session ?? null);
  const [sessionCheckError, setSessionCheckError] = useState<string | null>(null);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginPassword, setLoginPassword] = useState('');
  const [loginPending, setLoginPending] = useState(false);
  const [googleClientId, setGoogleClientId] = useState<string | null>(null);
  const [appleEnabled, setAppleEnabled] = useState(false);
  const [passkeyEnabled, setPasskeyEnabled] = useState(false);

  useEffect(() => {
    let cancelled = false;

    if (session !== undefined) {
      setSessionCheckError(null);
      setActiveSession(session);
      return () => {
        cancelled = true;
      };
    }

    setSessionCheckError(null);
    setActiveSession(null);
    void sessionClient.getSession()
      .then((resolvedSession) => {
        if (!cancelled) {
          setSessionCheckError(null);
          setActiveSession(resolvedSession);
          if (!canAccessProtectedRoute(resolvedSession)) {
            try {
              window.history.replaceState({}, '', '/login');
            } catch {
              // Browser history can be unavailable in isolated DOM tests.
            }
            setCurrentPath('/login');
          }
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSessionCheckError(
            'Your session could not be verified because the server is temporarily unavailable.',
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, [session, sessionClient]);

  useEffect(() => {
    let cancelled = false;
    if (session !== undefined) return () => undefined;

    void Promise.all([getAppleAuthConfig(), getPasskeyAuthConfig()])
      .then(([appleConfig, passkeyConfig]) => {
        if (!cancelled) {
          setAppleEnabled(appleConfig.enabled);
          setPasskeyEnabled(passkeyConfig.enabled);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAppleEnabled(false);
          setPasskeyEnabled(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [session]);

  useEffect(() => {
    let cancelled = false;
    if (session !== undefined) return () => undefined;

    void sessionClient.getGoogleAuthConfig()
      .then((config) => {
        if (!cancelled && config.enabled) setGoogleClientId(config.clientId);
      })
      .catch(() => {
        if (!cancelled) setGoogleClientId(null);
      });

    return () => {
      cancelled = true;
    };
  }, [session, sessionClient]);

  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname);
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  const setBrowserPath = (href: string, replace = false) => {
    try {
      if (replace) {
        window.history.replaceState({}, '', href);
      } else {
        window.history.pushState({}, '', href);
      }
    } catch {
      // Browser history can be unavailable in isolated DOM tests.
    }
    setCurrentPath(href);
  };

  const refreshActiveSession = async () => {
    if (session !== undefined) return;
    setSessionCheckError(null);
    setActiveSession(null);
    try {
      const resolvedSession = await sessionClient.getSession();
      setActiveSession(resolvedSession);
      if (!canAccessProtectedRoute(resolvedSession)) {
        setBrowserPath('/login', true);
      }
    } catch {
      setSessionCheckError(
        'Your session could not be verified because the server is temporarily unavailable.',
      );
    }
  };

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoginError(null);
    setLoginPending(true);

    try {
      const result = await sessionClient.login({
        email: loginEmail.trim(),
        password: loginPassword,
      });
      if (!result.ok) {
        setLoginError(result.error.message);
        return;
      }

      setSessionCheckError(null);
      setLoginPassword('');
      setBrowserPath('/', true);
      setActiveSession(result.data.session);
    } catch {
      setLoginError('Sign in is temporarily unavailable. Try again.');
    } finally {
      setLoginPending(false);
    }
  };

  const handleGoogleCredential = useCallback(
    async (credential: string) => {
      setLoginError(null);
      setLoginPending(true);
      try {
        const result = await sessionClient.loginWithGoogleCredential(credential);
        if (!result.ok) {
          setLoginError(result.error.message);
          return;
        }
        setSessionCheckError(null);
        setBrowserPath('/', true);
        setActiveSession(result.data.session);
      } catch {
        setLoginError('Google sign-in is temporarily unavailable. Try again.');
      } finally {
        setLoginPending(false);
      }
    },
    [sessionClient],
  );

  const handlePasskeyLogin = useCallback(async () => {
    setLoginError(null);
    setLoginPending(true);
    try {
      const result = await loginWithPasskey();
      if (!result.ok) {
        setLoginError(result.error.message);
        return;
      }
      setSessionCheckError(null);
      setBrowserPath('/', true);
      setActiveSession(result.data.session);
    } finally {
      setLoginPending(false);
    }
  }, []);

  const handleAppleSignIn = useCallback(() => {
    window.location.assign('/api/auth/apple/start');
  }, []);

  const handleSignOut = async () => {
    setActiveSession(null);
    setSessionCheckError(null);
    setBrowserPath('/login', true);
    if (session !== undefined) {
      setActiveSession(getUnauthenticatedSession());
      return;
    }
    try {
      const response = await sessionClient.logout();
      setActiveSession(response.session);
    } catch {
      setActiveSession(getUnauthenticatedSession());
    }
  };

  const handleNavigate = (href: string) => {
    setBrowserPath(href);
  };

  if (activeSession === null) {
    return (
      <ThemePresetProvider
        initialPresetName={getStoredThemePreset()}
        preferenceClient={loginPreferenceClient}
      >
        <SessionSplash
          error={sessionCheckError}
          onRetry={() => void refreshActiveSession()}
        />
      </ThemePresetProvider>
    );
  }

  if (!canAccessProtectedRoute(activeSession)) {
    return (
      <ThemePresetProvider
        initialPresetName={getStoredThemePreset()}
        preferenceClient={loginPreferenceClient}
      >
        <LoginPage
          appleEnabled={appleEnabled}
          email={loginEmail}
          error={loginError}
          googleClientId={googleClientId}
          onEmailChange={setLoginEmail}
          onGoogleCredential={handleGoogleCredential}
          onAppleSignIn={handleAppleSignIn}
          onPasskeyLogin={handlePasskeyLogin}
          onPasswordChange={setLoginPassword}
          onRetry={() => void refreshActiveSession()}
          onSubmit={(event) => void handleLogin(event)}
          password={loginPassword}
          pending={loginPending}
          passkeyEnabled={passkeyEnabled}
          showRetry={session === undefined}
        />
      </ThemePresetProvider>
    );
  }

  return (
    <ThemePresetProvider preferenceClient={preferenceClient}>
      <>
        <AccountMotionNavigation currentPath={currentPath} onNavigate={handleNavigate} />
        <AppShell
          currentPath={currentPath}
          onNavigate={handleNavigate}
          onSignOut={() => void handleSignOut()}
          session={activeSession}
        >
          <AppRouteContent
            activeSession={activeSession}
            currentPath={currentPath}
            dashboardClient={dashboardClient}
            fdrClient={fdrClient}
            leagueClient={leagueClient}
            managerDeskClient={managerDeskClient}
            onNavigate={handleNavigate}
            onSignOut={() => void handleSignOut()}
            squadClient={squadClient}
            teamSelectionClient={teamSelectionClient}
          />
        </AppShell>
        <GlobalNavigation currentPath={currentPath} onNavigate={handleNavigate} />
      </>
    </ThemePresetProvider>
  );
}

function AccountMotionNavigation({
  currentPath,
  onNavigate,
}: {
  currentPath: string;
  onNavigate: (href: string) => void;
}) {
  const { accountMotionGestureEnabled } = useThemePreset();

  useAccountMotionGesture({
    enabled: accountMotionGestureEnabled,
    onTrigger: () => {
      if (currentPath !== '/profile') onNavigate('/profile');
    },
  });

  return null;
}

interface AppRouteContentProps {
  activeSession: SessionState;
  currentPath: string;
  dashboardClient?: DashboardClient;
  fdrClient?: FdrClient;
  leagueClient?: LeagueClient;
  managerDeskClient?: ManagerDeskClient;
  onNavigate: (href: string) => void;
  onSignOut: () => void;
  squadClient?: SquadClient;
  teamSelectionClient?: TeamSelectionClient;
}

function AppRouteContent({
  activeSession,
  currentPath,
  dashboardClient,
  fdrClient,
  leagueClient,
  managerDeskClient,
  onNavigate,
  onSignOut,
  squadClient,
  teamSelectionClient,
}: AppRouteContentProps) {
  const { attackDirection, preset } = useThemePreset();
  const activeRouteKey = getPageRouteKey(currentPath);
  const [routePaths, setRoutePaths] = useState<Record<string, string>>(() => ({
    [activeRouteKey]: currentPath,
  }));
  const previousRouteKey = useRef(activeRouteKey);
  const scrollPositions = useRef(new Map<string, number>());

  // Browser history restoration runs before async page data exists. On a
  // fresh app mount that can restore a stale offset into the loading state,
  // then move the page again when the Desk content expands. SPA navigation
  // owns scroll restoration below, so disable the browser's competing policy
  // and start every app load at the top.
  useLayoutEffect(() => {
    const previousScrollRestoration = window.history.scrollRestoration;
    window.history.scrollRestoration = 'manual';
    try {
      window.scrollTo({ behavior: 'auto', left: 0, top: 0 });
    } catch {
      // Isolated DOM environments may not implement scrollTo.
    }

    return () => {
      window.history.scrollRestoration = previousScrollRestoration;
    };
  }, []);

  // Keep the last path for each page identity. This lets nested page paths
  // (for example League fixtures/table) share one mounted page instance.
  useEffect(() => {
    setRoutePaths((current) => {
      if (current[activeRouteKey] === currentPath) return current;
      return { ...current, [activeRouteKey]: currentPath };
    });
  }, [activeRouteKey, currentPath]);

  // Remember each page's scroll position while it is active and restore it
  // before the browser paints when the user returns to that page.
  useEffect(() => {
    const handleScroll = () => {
      scrollPositions.current.set(activeRouteKey, window.scrollY);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [activeRouteKey]);

  useLayoutEffect(() => {
    const previousKey = previousRouteKey.current;
    if (previousKey === activeRouteKey) return;

    scrollPositions.current.set(previousKey, window.scrollY);
    previousRouteKey.current = activeRouteKey;
    const targetScrollTop = scrollPositions.current.get(activeRouteKey) ?? 0;
    try {
      window.scrollTo({ behavior: 'auto', left: 0, top: targetScrollTop });
    } catch {
      // Isolated DOM environments may not implement scrollTo.
    }
  }, [activeRouteKey]);

  const renderRouteContent = (path: string) => {
    let routeContent = (
      <ManagerDeskPage
        deskClient={managerDeskClient}
        leagueClient={leagueClient}
        onNavigate={onNavigate}
        onSignOut={onSignOut}
        session={activeSession}
        squadClient={squadClient}
        teamSelectionClient={teamSelectionClient}
      />
    );

    if (path.startsWith('/account') || path.startsWith('/profile')) {
      routeContent = <ProfilePage currentPath={path} onNavigate={onNavigate} session={activeSession} squadClient={squadClient} />;
    }

    if (path === '/account/result-colours' || path === '/profile/result-colours') {
      routeContent = <ResultColourProfilePage onNavigate={onNavigate} />;
    }

    if (path.startsWith('/rules')) {
      routeContent = <RulesPage categories={['squads', 'trades']} sections={featuredRules} preset={preset} />;
    }

    if (path.startsWith('/league')) {
      routeContent = <LeaguePage attackDirection={attackDirection} currentPath={path} leagueClient={leagueClient} onNavigate={onNavigate} squadClient={squadClient} teamSelectionClient={teamSelectionClient} />;
    }

    if (path.startsWith('/modernisation/checkpoint-1')) {
      routeContent = <ModernisationCheckpointPage />;
    }

    if (path.startsWith('/modernisation/checkpoint-2')) {
      routeContent = <ModernisationCheckpointPage checkpoint={2} />;
    }

    if (path.startsWith('/modernisation/checkpoint-3')) {
      routeContent = <ModernisationCheckpointPage checkpoint={3} />;
    }

    if (path.startsWith('/modernisation/checkpoint-4')) {
      routeContent = <ModernisationCheckpointPage checkpoint={4} />;
    }

    if (path.startsWith('/modernisation/checkpoint-5')) {
      routeContent = <ModernisationCheckpointPage checkpoint={5} />;
    }

    if (path.startsWith('/dashboard/analytics') || path.startsWith('/analytics')) {
      routeContent = <AnalyticsDashboardPage dashboardClient={dashboardClient} />;
    }

    if (path === '/dashboard' || path === '/team' || path === '/') {
      routeContent = (
        <ManagerDeskPage
          deskClient={managerDeskClient}
          leagueClient={leagueClient}
          onNavigate={onNavigate}
          onSignOut={onSignOut}
          session={activeSession}
          squadClient={squadClient}
          teamSelectionClient={teamSelectionClient}
        />
      );
    }

    if (path.startsWith('/fdr')) {
      routeContent = <FixtureDifficultyPage fdrClient={fdrClient} />;
    }

    if (path.startsWith('/scouting')) {
      routeContent = <MarketPage currentPath={path} onNavigate={onNavigate} preset={preset} />;
    }

    const playerProfileMatch = path.match(/^\/players\/([^/]+)$/);
    if (playerProfileMatch) {
      routeContent = (
        <PlayerProfilePage
          onNavigate={onNavigate}
          playerId={decodeURIComponent(playerProfileMatch[1])}
          squadClient={squadClient}
          teamSelectionClient={teamSelectionClient}
        />
      );
    }

    if (isSquadRoute(path)) {
      routeContent = <SquadWorkspacePage attackDirection={attackDirection} onNavigate={onNavigate} preset={preset} squadClient={squadClient} teamSelectionClient={teamSelectionClient} />;
    }

    return routeContent;
  };

  const pathsToRender = { ...routePaths, [activeRouteKey]: currentPath };
  return (
    <div className="app-route-cache">
      {Object.entries(pathsToRender).map(([routeKey, path]) => {
        const isActive = routeKey === activeRouteKey;
        return (
          <div
            aria-hidden={isActive ? undefined : true}
            className="app-route-cache__entry"
            data-route-key={routeKey}
            hidden={!isActive}
            key={routeKey}
          >
            {renderRouteContent(path)}
          </div>
        );
      })}
    </div>
  );
}
